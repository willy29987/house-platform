import type { Prisma } from "@prisma/client";
import type { AdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { prisma } from "@/lib/prisma";

export async function readAdminCloudPayload(key: AdminCloudDataKey): Promise<unknown | null> {
  const row = await prisma.adminCloudData.findUnique({ where: { key } });
  return row?.payload ?? null;
}

export async function writeAdminCloudPayload(key: AdminCloudDataKey, payload: unknown): Promise<void> {
  await prisma.adminCloudData.upsert({
    where: { key },
    create: { key, payload: payload as Prisma.InputJsonValue },
    update: { payload: payload as Prisma.InputJsonValue },
  });
}
