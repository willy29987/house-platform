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

async function lineImage(newListingsCount?: number) {
  if (newListingsCount) {
    return readFile(
      path.join(process.cwd(), "public/line/new-listings", `${newListingsCount}.png`),
    );
  }
  return readFile(path.join(process.cwd(), "public/line/guest-rich-menu.png"));
}

async function createFindHomeMenu(
  token: string,
  uri: string,
  look: { newListingsCount?: number; chatBarText?: string; name?: string } = {},
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
      name: look.name ?? "開始找房",
      chatBarText: look.chatBarText ?? "開始找房",
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

  const image = await lineImage(look.newListingsCount);
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
  if (!uploaded.ok) {
    await deleteRichMenu(token, richMenuId);
    return null;
  }
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

  // 正在顯示「新物件」選單時先不蓋掉，等客人看過再換回這張
  const showingNewListings = Boolean((await readNewListings()).byUser[userId]);
  if (!showingNewListings) {
    const linked = await fetch(
      `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${richMenuId}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!linked.ok) {
      await deleteRichMenu(token, richMenuId);
      return;
    }
  }

  if (existingId && existingId !== richMenuId) {
    await deleteRichMenu(token, existingId);
  }

  const latest = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus),
  );
  latest.menus[userId] = richMenuId;
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus, latest);
}

type NewListingsEntry = { listingIds: string[]; menuId: string; updatedAt: string };
type NewListingsStore = { byUser: Record<string, NewListingsEntry> };

const MAX_NEW_LISTINGS = 20;

function normalizeNewListings(payload: unknown): NewListingsStore {
  const raw = (payload as NewListingsStore | null)?.byUser;
  if (!raw || typeof raw !== "object") return { byUser: {} };
  const byUser: Record<string, NewListingsEntry> = {};
  for (const [userId, entry] of Object.entries(raw)) {
    if (!userId || !entry || typeof entry.menuId !== "string" || !Array.isArray(entry.listingIds)) {
      continue;
    }
    byUser[userId] = {
      listingIds: entry.listingIds.filter((id) => typeof id === "string" && id),
      menuId: entry.menuId,
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
    };
  }
  return { byUser };
}

async function readNewListings() {
  return normalizeNewListings(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestNewListings),
  );
}

/** 客人還沒看過的新物件（開 LIFF「新物件」時用） */
export async function getGuestNewListingIds(lineUserId: string): Promise<string[]> {
  const store = await readNewListings();
  return store.byUser[lineUserId.trim()]?.listingIds ?? [];
}

/**
 * 有新物件符合客人條件：把他的圖文選單換成「N 間新物件」版。
 * 換選單不是訊息，不算 LINE 月額度。
 */
export async function flagGuestNewListing(lineUserId: string, listingId: string) {
  const userId = lineUserId.trim();
  if (!userId.startsWith("U") || !listingId) return false;
  const token = await getLineChannelAccessToken();
  if (!token) return false;

  const before = (await readNewListings()).byUser[userId];
  const listingIds = [listingId, ...(before?.listingIds ?? []).filter((id) => id !== listingId)].slice(
    0,
    MAX_NEW_LISTINGS,
  );
  const count = Math.min(listingIds.length, 9);
  const richMenuId = await createFindHomeMenu(
    token,
    buildLiffRentAssistantUrl({ uid: userId, fresh: "1" }),
    {
      newListingsCount: count,
      chatBarText: `🔴 ${count >= 9 ? "9+" : count} 間新物件`,
      name: "新物件提醒",
    },
  );
  if (!richMenuId) return false;

  const linked = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${richMenuId}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!linked.ok) {
    await deleteRichMenu(token, richMenuId);
    return false;
  }

  const latest = await readNewListings();
  const previousMenuId = latest.byUser[userId]?.menuId;
  latest.byUser[userId] = { listingIds, menuId: richMenuId, updatedAt: new Date().toISOString() };
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestNewListings, latest);
  if (previousMenuId && previousMenuId !== richMenuId) {
    await deleteRichMenu(token, previousMenuId);
  }
  return true;
}

/** 客人點進來看過新物件：換回原本的「開始找房」選單。 */
export async function clearGuestNewListings(lineUserId: string) {
  const userId = lineUserId.trim();
  const store = await readNewListings();
  const entry = store.byUser[userId];
  if (!entry) return;
  const token = await getLineChannelAccessToken();
  if (!token) return;

  const personal = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestRichMenus),
  ).menus[userId];
  const restored = personal
    ? await fetch(
        `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${personal}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      )
    : await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
  if (!restored.ok) return;

  const latest = await readNewListings();
  if (latest.byUser[userId]?.menuId === entry.menuId) {
    delete latest.byUser[userId];
    await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestNewListings, latest);
  }
  await deleteRichMenu(token, entry.menuId);
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
