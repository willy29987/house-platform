/** 正式站缺 LINE token 時，暫存待補推的客人確認訊息 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

export type LineGuestPushItem = {
  id: string;
  caseId: string;
  lineUserId: string;
  text: string;
  createdAt: string;
};

type Store = { items: LineGuestPushItem[] };

function normalize(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return { items: [] };
  const items = Array.isArray((payload as Store).items) ? (payload as Store).items : [];
  return {
    items: items
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.lineUserId === "string" &&
          typeof item.text === "string",
      )
      .slice(0, 100),
  };
}

export async function enqueueLineGuestPush(input: {
  caseId: string;
  lineUserId: string;
  text: string;
}) {
  const store = normalize(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestPushQueue),
  );
  const item: LineGuestPushItem = {
    id: `gp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    caseId: input.caseId,
    lineUserId: input.lineUserId,
    text: input.text,
    createdAt: new Date().toISOString(),
  };
  store.items = [item, ...store.items.filter((row) => row.caseId !== input.caseId)].slice(
    0,
    100,
  );
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestPushQueue, store);
  return item;
}

export async function readLineGuestPushQueue(): Promise<LineGuestPushItem[]> {
  const store = normalize(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestPushQueue),
  );
  return store.items;
}

export async function clearLineGuestPushItems(ids: string[]) {
  if (!ids.length) return;
  const store = normalize(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestPushQueue),
  );
  const drop = new Set(ids);
  store.items = store.items.filter((item) => !drop.has(item.id));
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestPushQueue, store);
}
