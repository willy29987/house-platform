/**
 * 591 同步／客人彙整推播時段設定（伺服器讀寫）。
 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import {
  normalizeOpsSchedule,
  type OpsSchedule,
} from "@/lib/ops-schedule-shared";

export * from "@/lib/ops-schedule-shared";

export async function readOpsSchedule(): Promise<OpsSchedule> {
  return normalizeOpsSchedule(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.opsSchedule));
}

export async function writeOpsSchedule(schedule: OpsSchedule): Promise<OpsSchedule> {
  const next = normalizeOpsSchedule(schedule);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.opsSchedule, next, { replace: true });
  return next;
}
