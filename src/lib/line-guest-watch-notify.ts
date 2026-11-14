/** 新上架的出租物件若符合客人已存條件：換他的圖文選單提醒（免費），並嘗試推播（算額度）。 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { listActiveGuestWatches, watchRecordToCriteria, type GuestWatchRecord } from "@/lib/line-guest-watch";
import {
  listingMatchesCriteria,
  loadPublishedRentalMatchListing,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { flagGuestNewListing } from "@/lib/line-guest-rich-menu";
import { buildLiffRentAssistantUrl, pushLineMessages } from "@/lib/line-messaging";

type SentStore = { byUser: Record<string, string[]> };

function emptySent(): SentStore {
  return { byUser: {} };
}

function normalizeSent(payload: unknown): SentStore {
  if (!payload || typeof payload !== "object") return emptySent();
  const raw = (payload as SentStore).byUser;
  if (!raw || typeof raw !== "object") return emptySent();
  const byUser: Record<string, string[]> = {};
  for (const [userId, ids] of Object.entries(raw)) {
    if (!userId || !Array.isArray(ids)) continue;
    byUser[userId] = ids.filter((id) => typeof id === "string" && id).slice(0, 300);
  }
  return { byUser };
}

function watchAccepts(watch: GuestWatchRecord, listing: RentalMatchListing) {
  if (!listingMatchesCriteria(listing, watchRecordToCriteria(watch))) return false;
  if (watch.priceMin != null && listing.price < watch.priceMin) return false;
  if (watch.priceMax != null && listing.price > watch.priceMax) return false;
  if (watch.petNote && watch.petNote !== "沒有" && listing.petsAllowed === false) return false;
  return true;
}

function recommendationMessages(listing: RentalMatchListing, lineUserId: string) {
  const price = listing.price.toLocaleString("zh-TW");
  const uri = buildLiffRentAssistantUrl({ uid: lineUserId, listingId: listing.id });
  return [
    {
      type: "text" as const,
      text: [
        "有一間新上架的物件符合你的找房條件：",
        listing.title,
        `${listing.city}${listing.district}`,
        `${price} 元/月 · ${listing.areaPing} 坪`,
      ].join("\n"),
    },
    {
      type: "template" as const,
      altText: `新物件符合你的條件：${listing.title}`,
      template: {
        type: "buttons" as const,
        text: "點下方看照片與資訊，想看再約時間。",
        actions: [{ type: "uri" as const, label: "看這間物件", uri }],
      },
    },
  ];
}

/** 這間剛變成上架中的出租物件，推給還沒收過、且條件符合的客人。 */
export async function notifyMatchingGuestsOfRental(listingId: string) {
  const listing = await loadPublishedRentalMatchListing(listingId);
  if (!listing) return { notified: 0 };
  const watches = await listActiveGuestWatches();
  if (!watches.length) return { notified: 0 };

  const sent = normalizeSent(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchPushes),
  );
  let notified = 0;
  let changed = false;

  for (const watch of watches) {
    const already = sent.byUser[watch.lineUserId] ?? [];
    if (already.includes(listing.id)) continue;
    if (!watchAccepts(watch, listing)) continue;
    const flagged = await flagGuestNewListing(watch.lineUserId, listing.id).catch((error) => {
      console.warn("[line-guest-watch-notify] new-listing menu failed", error);
      return false;
    });
    const result = await pushLineMessages(
      watch.lineUserId,
      recommendationMessages(listing, watch.lineUserId),
      { force: true, logAs: "bot" },
    );
    if (!flagged && !result.sent) continue;
    sent.byUser[watch.lineUserId] = [listing.id, ...already].slice(0, 300);
    notified += 1;
    changed = true;
  }

  if (changed) {
    await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchPushes, sent);
  }
  return { notified };
}
