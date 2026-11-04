import type { Prisma } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS, type AdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { prisma } from "@/lib/prisma";
import {
  normalizeOwnerTrackingListingChecksStore,
  type OwnerTrackingListingChecksStore,
} from "@/lib/owner-tracking-listing-checks";
import {
  mergeOwnerTrackingStoresForCloudWrite,
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";

export type WriteAdminCloudPayloadOptions = {
  /** 屋主追蹤刪除等需整包覆寫時設 true；預設會與現有雲端聯集合併，避免舊裝置抹掉進度 */
  replace?: boolean;
};

function preparePayloadForStorage(key: AdminCloudDataKey, payload: unknown): unknown {
  if (key === ADMIN_CLOUD_DATA_KEYS.ownerTracking && payload && typeof payload === "object") {
    return normalizeOwnerTrackingStore(payload as OwnerTrackingStore);
  }
  if (
    key === ADMIN_CLOUD_DATA_KEYS.ownerTrackingListingChecks &&
    payload &&
    typeof payload === "object"
  ) {
    return normalizeOwnerTrackingListingChecksStore(payload as OwnerTrackingListingChecksStore);
  }
  return payload;
}

function adminCloudDataDelegate() {
  const delegate = (prisma as { adminCloudData?: { findUnique: unknown; upsert: unknown } }).adminCloudData;
  if (!delegate?.findUnique || !delegate?.upsert) {
    return null;
  }
  return delegate as {
    findUnique: (args: { where: { key: string } }) => Promise<{ payload: unknown } | null>;
    upsert: (args: {
      where: { key: string };
      create: { key: string; payload: Prisma.InputJsonValue };
      update: { payload: Prisma.InputJsonValue };
    }) => Promise<unknown>;
  };
}

export async function readAdminCloudPayload(key: AdminCloudDataKey): Promise<unknown | null> {
  const cloud = adminCloudDataDelegate();
  if (!cloud) {
    console.warn("[admin-cloud] AdminCloudData 不可用（請執行 npx prisma generate 並確認 DATABASE_URL）");
    return null;
  }
  const row = await cloud.findUnique({ where: { key } });
  if (!row?.payload) return null;
  return preparePayloadForStorage(key, row.payload);
}

export async function writeAdminCloudPayload(
  key: AdminCloudDataKey,
  payload: unknown,
  opts?: WriteAdminCloudPayloadOptions,
): Promise<void> {
  const cloud = adminCloudDataDelegate();
  if (!cloud) {
    throw new Error("雲端資料庫未就緒（AdminCloudData）");
  }

  let toWrite = preparePayloadForStorage(key, payload);

  if (
    key === ADMIN_CLOUD_DATA_KEYS.ownerTracking &&
    !opts?.replace &&
    toWrite &&
    typeof toWrite === "object"
  ) {
    const existing = await readAdminCloudPayload(key);
    if (existing && typeof existing === "object") {
      toWrite = mergeOwnerTrackingStoresForCloudWrite(
        normalizeOwnerTrackingStore(existing as OwnerTrackingStore),
        normalizeOwnerTrackingStore(toWrite as OwnerTrackingStore),
      );
    }
  }

  await cloud.upsert({
    where: { key },
    create: { key, payload: toWrite as Prisma.InputJsonValue },
    update: { payload: toWrite as Prisma.InputJsonValue },
  });
}
