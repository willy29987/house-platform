import {
  ADMIN_CLOUD_DATA_KEYS,
  type AdminCloudDataKey,
} from "@/lib/admin-cloud-data-keys";
export { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import type { CommissionRecord } from "@/lib/commission-stats";
import {
  emptyOwnerTrackingStore,
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import type { TenantManagerStore } from "@/lib/tenant-manager-storage";

const pushTimers = new Map<AdminCloudDataKey, ReturnType<typeof setTimeout>>();

async function fetchCloudPayload(key: AdminCloudDataKey): Promise<unknown | null> {
  const res = await fetch(`/api/admin/cloud-data/${key}`, { credentials: "same-origin" });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok?: boolean; payload?: unknown };
  if (!json.ok) return null;
  return json.payload ?? null;
}

export async function pushCloudPayload(key: AdminCloudDataKey, payload: unknown): Promise<void> {
  await fetch(`/api/admin/cloud-data/${key}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
}

export function schedulePushCloudPayload(key: AdminCloudDataKey, payload: unknown, delayMs = 400): void {
  const prev = pushTimers.get(key);
  if (prev) clearTimeout(prev);
  pushTimers.set(
    key,
    setTimeout(() => {
      pushTimers.delete(key);
      void pushCloudPayload(key, payload);
    }, delayMs),
  );
}

function hasOwnerTrackingData(store: OwnerTrackingStore): boolean {
  return store.cases.length > 0 || store.followUps.length > 0;
}

function hasCommissionData(records: CommissionRecord[]): boolean {
  return records.length > 0;
}

function hasTenantData(store: TenantManagerStore): boolean {
  return store.tenants.length > 0 || Object.keys(store.rent).length > 0 || Object.keys(store.utility).length > 0;
}

let ownerTrackingHydrate: Promise<OwnerTrackingStore> | null = null;

export function invalidateOwnerTrackingHydrateCache(): void {
  ownerTrackingHydrate = null;
}

/** 屋主追蹤：雲端為準；雲端空且本機有資料則上傳一次（同步失敗時絕不覆寫雲端） */
export function hydrateOwnerTrackingStoreOnce(
  readLocal: () => OwnerTrackingStore,
  writeLocal: (store: OwnerTrackingStore) => void,
): Promise<OwnerTrackingStore> {
  if (!ownerTrackingHydrate) {
    ownerTrackingHydrate = (async () => {
      try {
        const local = normalizeOwnerTrackingStore(readLocal());
        const res = await fetch(`/api/admin/cloud-data/${ADMIN_CLOUD_DATA_KEYS.ownerTracking}`, {
          credentials: "same-origin",
        });
        const cloudFetchOk = res.ok;
        let rawCloud: OwnerTrackingStore | null = null;
        if (cloudFetchOk) {
          const json = (await res.json()) as { ok?: boolean; payload?: unknown };
          rawCloud = (json.payload as OwnerTrackingStore | undefined) ?? null;
        }
        const cloud = rawCloud ? normalizeOwnerTrackingStore(rawCloud) : null;
        if (cloud && hasOwnerTrackingData(cloud)) {
          writeLocal(cloud);
          return cloud;
        }
        if (hasOwnerTrackingData(local)) {
          if (!cloudFetchOk) {
            console.warn("[owner-tracking] 雲端讀取失敗，僅顯示本機快取，不上傳以免覆蓋雲端");
            return local;
          }
          await pushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking, local);
          return local;
        }
        return emptyOwnerTrackingStore;
      } catch (e) {
        console.error("[owner-tracking] cloud hydrate failed", e);
        const local = normalizeOwnerTrackingStore(readLocal());
        return hasOwnerTrackingData(local) ? local : emptyOwnerTrackingStore;
      }
    })();
  }
  return ownerTrackingHydrate;
}

/** 強制重新自雲端拉資料（例如分頁重新聚焦） */
export function refreshOwnerTrackingFromCloud(
  readLocal: () => OwnerTrackingStore,
  writeLocal: (store: OwnerTrackingStore) => void,
): Promise<OwnerTrackingStore> {
  invalidateOwnerTrackingHydrateCache();
  return hydrateOwnerTrackingStoreOnce(readLocal, writeLocal);
}

let commissionHydrate: Promise<CommissionRecord[]> | null = null;

export function hydrateCommissionRecordsOnce(
  readLocal: () => CommissionRecord[],
  writeLocal: (records: CommissionRecord[]) => void,
): Promise<CommissionRecord[]> {
  if (!commissionHydrate) {
    commissionHydrate = (async () => {
      try {
        const local = readLocal();
        const cloud = (await fetchCloudPayload(ADMIN_CLOUD_DATA_KEYS.commissionRecords)) as CommissionRecord[] | null;
        if (Array.isArray(cloud) && cloud.length > 0) {
          writeLocal(cloud);
          return cloud;
        }
        if (hasCommissionData(local)) {
          await pushCloudPayload(ADMIN_CLOUD_DATA_KEYS.commissionRecords, local);
          return local;
        }
        return [];
      } catch (e) {
        console.error("[commission] cloud hydrate failed", e);
        const local = readLocal();
        return hasCommissionData(local) ? local : [];
      }
    })();
  }
  return commissionHydrate;
}

let tenantHydrate: Promise<TenantManagerStore> | null = null;

export function hydrateTenantManagerStoreOnce(
  readLocal: () => TenantManagerStore,
  writeLocal: (store: TenantManagerStore) => void,
  empty: TenantManagerStore,
): Promise<TenantManagerStore> {
  if (!tenantHydrate) {
    tenantHydrate = (async () => {
      const local = readLocal();
      const cloud = (await fetchCloudPayload(ADMIN_CLOUD_DATA_KEYS.tenantManager)) as TenantManagerStore | null;
      if (cloud && hasTenantData(cloud)) {
        writeLocal(cloud);
        return cloud;
      }
      if (hasTenantData(local)) {
        await pushCloudPayload(ADMIN_CLOUD_DATA_KEYS.tenantManager, local);
        return local;
      }
      return empty;
    })();
  }
  return tenantHydrate;
}

/** 進入後台時預先同步三種資料（與各頁 hydrateOnce 共用同一 Promise） */
export function prefetchAdminCloudData(): void {
  if (typeof window === "undefined") return;
  void import("@/lib/owner-tracking-preview").then(({ loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal }) =>
    hydrateOwnerTrackingStoreOnce(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal),
  );
  void import("@/lib/commission-stats").then(({ loadCommissionRecordsLocal, persistCommissionRecordsLocal }) =>
    hydrateCommissionRecordsOnce(loadCommissionRecordsLocal, persistCommissionRecordsLocal),
  );
  void import("@/lib/tenant-manager-storage").then(
    ({ loadTenantManagerStoreLocal, persistTenantManagerStoreLocal, emptyTenantManagerStore }) =>
      hydrateTenantManagerStoreOnce(
        loadTenantManagerStoreLocal,
        persistTenantManagerStoreLocal,
        emptyTenantManagerStore,
      ),
  );
}
