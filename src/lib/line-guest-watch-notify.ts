/**
 * 新上架的出租物件若符合客人已存條件：
 * - 立即換他的圖文選單提醒（免費；看過改溫和「繼續看屋」）
 * - 每天中午 12:00 彙整推播（算額度）：成功推播才算 1 天，每位客人終身最多 4 天
 *   （重存找房條件也不重置）
 * - 每次推播濃縮成一則訊息（多間用物件卡左右滑）
 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { listActiveGuestWatches, watchRecordToCriteria, type GuestWatchRecord } from "@/lib/line-guest-watch";
import {
  listingMatchesCriteria,
  loadPublishedRentalMatchListing,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { clearGuestNewListings, flagGuestNewListing } from "@/lib/line-guest-rich-menu";
import { buildListingCardsFlex } from "@/lib/line-listing-flex";
import { pushLineMessages, type LineMessage } from "@/lib/line-messaging";

/** 成功推播次數上限（有推出去才算 1 天） */
export const MAX_PUSH_DAYS = 4;
const MAX_PENDING = 10;

type SentStore = {
  byUser: Record<string, string[]>;
  pending: Record<string, string[]>;
  lastPushDay: Record<string, string>;
  /** 已成功推播次數（終身累計，重存條件也不重置） */
  pushCount: Record<string, number>;
};

function emptySent(): SentStore {
  return { byUser: {}, pending: {}, lastPushDay: {}, pushCount: {} };
}

function stringIds(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && Boolean(id)).slice(0, max);
}

function normalizeSent(payload: unknown): SentStore {
  const store = emptySent();
  if (!payload || typeof payload !== "object") return store;
  const raw = payload as Partial<SentStore>;
  for (const [userId, ids] of Object.entries(raw.byUser ?? {})) {
    if (userId) store.byUser[userId] = stringIds(ids, 300);
  }
  for (const [userId, ids] of Object.entries(raw.pending ?? {})) {
    const list = stringIds(ids, MAX_PENDING);
    if (userId && list.length) store.pending[userId] = list;
  }
  for (const [userId, day] of Object.entries(raw.lastPushDay ?? {})) {
    if (userId && typeof day === "string") store.lastPushDay[userId] = day;
  }
  for (const [userId, count] of Object.entries(raw.pushCount ?? {})) {
    if (userId && typeof count === "number" && Number.isFinite(count) && count > 0) {
      store.pushCount[userId] = Math.floor(count);
    }
  }
  return store;
}

function taipeiDay(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function canPushMore(sent: SentStore, uid: string) {
  return (sent.pushCount[uid] ?? 0) < MAX_PUSH_DAYS;
}

function watchAccepts(watch: GuestWatchRecord, listing: RentalMatchListing) {
  if (!listingMatchesCriteria(listing, watchRecordToCriteria(watch))) return false;
  if (watch.priceMin != null && listing.price < watch.priceMin) return false;
  if (watch.priceMax != null && listing.price > watch.priceMax) return false;
  if (watch.petNote && watch.petNote !== "沒有" && listing.petsAllowed === false) return false;
  return true;
}

/** 一則訊息：只用 Flex 卡（含多間輪播），不算第二則文字。 */
function digestMessages(listings: RentalMatchListing[]): LineMessage[] {
  const prefix =
    listings.length === 1
      ? "有 1 間新物件符合你的條件："
      : `有 ${listings.length} 間新物件符合你的條件：`;
  const cards = buildListingCardsFlex(listings, prefix);
  return cards ? [cards] : [];
}

async function readSent() {
  return normalizeSent(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchPushes));
}

async function writeSent(store: SentStore) {
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchPushes, store);
}

/** 這間剛變成上架中的出租物件：符合條件的客人立即換選單；未滿 4 次推播則排入中午彙整。 */
export async function notifyMatchingGuestsOfRental(listingId: string) {
  const listing = await loadPublishedRentalMatchListing(listingId);
  if (!listing) return { notified: 0 };
  const watches = await listActiveGuestWatches();
  if (!watches.length) return { notified: 0 };

  const sent = await readSent();
  let notified = 0;

  for (const watch of watches) {
    const uid = watch.lineUserId;
    const already = sent.byUser[uid] ?? [];
    if (already.includes(listing.id)) continue;
    if (!watchAccepts(watch, listing)) continue;
    await flagGuestNewListing(uid, listing.id).catch((error) => {
      console.warn("[line-guest-watch-notify] new-listing menu failed", error);
    });
    sent.byUser[uid] = [listing.id, ...already].slice(0, 300);
    if (canPushMore(sent, uid)) {
      sent.pending[uid] = [listing.id, ...(sent.pending[uid] ?? [])].slice(0, MAX_PENDING);
    }
    notified += 1;
  }

  if (notified) await writeSent(sent);
  return { notified };
}

/** 客人已從圖文選單看過這批：中午就不必再推同一批（選單改溫和版由 rich-menu 處理）。 */
export async function clearGuestRecommendationPending(lineUserId: string) {
  const sent = await readSent();
  if (!sent.pending[lineUserId]) return;
  delete sent.pending[lineUserId];
  await writeSent(sent);
}

/** 約看送出後：清掉待推播，並換回開始找房選單。 */
export async function clearGuestRecommendationAfterBooking(lineUserId: string) {
  const uid = lineUserId.trim();
  if (!uid) return;
  await clearGuestRecommendationPending(uid);
  await clearGuestNewListings(uid).catch((error) => {
    console.warn("[line-guest-watch-notify] clear menu after booking failed", error);
  });
}

/** 每天中午：有 pending 的客人推一則（內含多間），成功才算 1 天，最多 4 天。 */
export async function sendGuestRecommendationDigest() {
  const sent = await readSent();
  const uids = Object.keys(sent.pending);
  const summary = {
    guests: uids.length,
    pushed: 0,
    skipped: 0,
    failed: 0,
    expired: 0,
  };
  if (!uids.length) return summary;

  const today = taipeiDay();
  const watches = new Map(
    (await listActiveGuestWatches()).map((watch) => [watch.lineUserId, watch]),
  );

  for (const uid of uids) {
    const watch = watches.get(uid);
    if (!watch) {
      delete sent.pending[uid];
      await clearGuestNewListings(uid).catch(() => null);
      summary.expired += 1;
      continue;
    }
    if ((sent.pushCount[uid] ?? 0) >= MAX_PUSH_DAYS) {
      delete sent.pending[uid];
      summary.expired += 1;
      continue;
    }
    if (sent.lastPushDay[uid] === today) {
      summary.skipped += 1;
      continue;
    }
    const loaded = await Promise.all(
      (sent.pending[uid] ?? []).map((id) => loadPublishedRentalMatchListing(id).catch(() => null)),
    );
    const listings = loaded.filter(
      (listing): listing is RentalMatchListing => Boolean(listing && watchAccepts(watch, listing)),
    );
    if (!listings.length) {
      delete sent.pending[uid];
      await clearGuestNewListings(uid).catch(() => null);
      summary.skipped += 1;
      continue;
    }
    const messages = digestMessages(listings);
    if (!messages.length) {
      summary.skipped += 1;
      continue;
    }
    const result = await pushLineMessages(uid, messages, {
      force: true,
      logAs: "bot",
    });
    if (result.sent) {
      delete sent.pending[uid];
      sent.lastPushDay[uid] = today;
      sent.pushCount[uid] = (sent.pushCount[uid] ?? 0) + 1;
      summary.pushed += 1;
    } else {
      summary.failed += 1;
    }
  }

  await writeSent(sent);
  return summary;
}
