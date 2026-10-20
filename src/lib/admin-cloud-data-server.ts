import type { Prisma } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS, type AdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { prisma } from "@/lib/prisma";
import {
  mergeOwnerTrackingStores,
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";

function preparePayloadForStorage(key: AdminCloudDataKey, payload: unknown): unknown {
  if (key === ADMIN_CLOUD_DATA_KEYS.ownerTracking && payload && typeof payload === "object") {
    return normalizeOwnerTrackingStore(payload as OwnerTrackingStore);
  }
  return payload;
}

export async function readAdminCloudPayload(key: AdminCloudDataKey): Promise<unknown | null> {
  const row = await prisma.adminCloudData.findUnique({ where: { key } });
  if (!row?.payload) return null;
  return preparePayloadForStorage(key, row.payload);
}

export async function writeAdminCloudPayload(key: AdminCloudDataKey, payload: unknown): Promise<void> {
  let toWrite = preparePayloadForStorage(key, payload);
  if (key === ADMIN_CLOUD_DATA_KEYS.ownerTracking) {
    const existing = await readAdminCloudPayload(key);
    if (existing && typeof existing === "object") {
      toWrite = mergeOwnerTrackingStores(
        existing as OwnerTrackingStore,
        toWrite as OwnerTrackingStore,
      );
    }
  }
  await prisma.adminCloudData.upsert({
    where: { key },
    create: { key, payload: toWrite as Prisma.InputJsonValue },
    update: { payload: toWrite as Prisma.InputJsonValue },
  });
}
