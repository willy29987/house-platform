/** 圖文選單直接打開找房表單，並在網址帶上這位客人的 uid。 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { buildLiffRentAssistantUrl, getLineChannelAccessToken } from "@/lib/line-messaging";

type Store = { menus: Record<string, string> };

function emptyStore(): Store {
  return { menus: {} };
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return emptyStore();
  const menus = (payload as Store).menus;
  if (!menus || typeof menus !== "object") return emptyStore();
  const next: Record<string, string> = {};
  for (const [userId, menuId] of Object.entries(menus)) {
    if (typeof userId === "string" && typeof menuId === "string" && userId && menuId) {
      next[userId] = menuId;
    }
  }
  return { menus: next };
}

async function lineImage() {
  return readFile(path.join(process.cwd(), "public/line/guest-rich-menu.png"));
}

async function createFindHomeMenu(
  token: string,
  uri: string,
): Promise<string | null> {
  const created = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      size: { width: 2500, height: 843 },
      selected: true,
      name: "開始找房",
      chatBarText: "開始找房",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 843 },
          action: { type: "uri", uri },
        },
      ],
    }),
  });
  const createdBody = (await created.json().catch(() => null)) as { richMenuId?: string } | null;
  const richMenuId = createdBody?.richMenuId;
  if (!created.ok || !richMenuId) return null;

  const image = await lineImage();
  const uploaded = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/png",
      },
      body: image,
    },
  );
  if (!uploaded.ok) return null;
  return richMenuId;
}

async function deleteRichMenu(token: string, richMenuId: string) {
  await fetch(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
}

/** 預設圖文選單：點下去直接開 LIFF（無個人 uid）。 */
export async function setDefaultFindHomeRichMenu() {
  const token = await getLineChannelAccessToken();
  if (!token) return { ok: false as const, reason: "missing_token" as const };

  const richMenuId = await createFindHomeMenu(token, buildLiffRentAssistantUrl());
  if (!richMenuId) return { ok: false as const, reason: "create_failed" as const };

  const linked = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!linked.ok) return { ok: false as const, reason: "link_failed" as const, richMenuId };
  return { ok: true as const, richMenuId };
}

/** 幫這位客人掛上「點下去就開 LIFF」的圖文選單。預設已掛過就不重建。 */
export async function ensureGuestFindHomeMenu(
  lineUserId: string,
  options?: { force?: boolean },
) {
  const userId = lineUserId.trim();
  if (!userId.startsWith("U")) return;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus),
  );
  const existingId = store.menus[userId];
  if (existingId && !options?.force) return;

  const token = await getLineChannelAccessToken();
  if (!token) return;

  const richMenuId = await createFindHomeMenu(
    token,
    buildLiffRentAssistantUrl({ uid: userId }),
  );
  if (!richMenuId) return;

  const linked = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${richMenuId}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!linked.ok) return;

  if (existingId && existingId !== richMenuId) {
    await deleteRichMenu(token, existingId);
  }

  const latest = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus),
  );
  latest.menus[userId] = richMenuId;
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus, latest);
}

/** 強制把已掛過個人選單的客人改成最新 LIFF 網址。 */
export async function refreshAllGuestFindHomeMenus() {
  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus),
  );
  const userIds = Object.keys(store.menus);
  let refreshed = 0;
  for (const userId of userIds) {
    await ensureGuestFindHomeMenu(userId, { force: true });
    refreshed += 1;
  }
  return { refreshed, userIds };
}
