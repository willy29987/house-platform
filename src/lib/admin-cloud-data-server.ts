import type { Prisma } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS, type AdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { prisma } from "@/lib/prisma";
import {
  normalizeOwnerTrackingListingChecksStore,
  type OwnerTrackingListingChecksStore,
} from "@/lib/owner-tracking-listing-checks";
import {
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";

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

export async function writeAdminCloudPayload(key: AdminCloudDataKey, payload: unknown): Promise<void> {
  const cloud = adminCloudDataDelegate();
  if (!cloud) {
    throw new Error("雲端資料庫未就緒（AdminCloudData）");
  }
  const toWrite = preparePayloadForStorage(key, payload);
  await cloud.upsert({
    where: { key },
    create: { key, payload: toWrite as Prisma.InputJsonValue },
    update: { payload: toWrite as Prisma.InputJsonValue },
  });
}
