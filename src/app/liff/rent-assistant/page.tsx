import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import type { LiffDirectListingEntry } from "@/components/line-liff-rent-form";
import {
  getGuestWatchByUserId,
  upsertGuestWatchCriteria,
  watchRecordToCriteria,
} from "@/lib/line-guest-watch";
import { LINE_LIFF_RENT_ASSISTANT_ID, messagingUidFromSearch } from "@/lib/line-liff-id";
import { getLineUserProfile } from "@/lib/line-messaging";
import { findLatestOpenViewing } from "@/lib/line-rental-cases";
import {
  emptyCriteria,
  loadPublishedRentalMatchListing,
  loadRentalMatchListings,
  widenCriteriaFromListing,
} from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";

function listingIdsFromParam(raw: string | string[] | undefined) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [
    ...new Set(
      list
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function truthyParam(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{
    liffId?: string;
    uid?: string;
    listingId?: string | string[];
    similar?: string | string[];
    "liff.state"?: string;
  }>;
}) {
  const params = await searchParams;
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;
  const search = new URLSearchParams();
  if (params.uid) search.set("uid", params.uid);
  if (params["liff.state"]) search.set("liff.state", params["liff.state"]);
  const fallbackLineUserId = messagingUidFromSearch(search.toString());
  const pushedListingIds = listingIdsFromParam(params.listingId);
  const similarMode = truthyParam(params.similar);
  const openViewing = fallbackLineUserId
    ? await findLatestOpenViewing(fallbackLineUserId)
    : null;
  const priorListingIds = openViewing?.picked.map((item) => item.id) ?? [];

  const cards = await loadRentalMatchListings(null, [...pushedListingIds, ...priorListingIds]);
  let directListing: LiffDirectListingEntry | null = null;

  const lineProfile = fallbackLineUserId ? await getLineUserProfile(fallbackLineUserId) : null;

  if (pushedListingIds.length && similarMode) {
    const seed =
      (await loadPublishedRentalMatchListing(pushedListingIds[0]!)) ||
      cards.find((item) => item.id === pushedListingIds[0]) ||
      null;
    if (seed) {
      const widened = widenCriteriaFromListing(seed);
      directListing = {
        listingIds: pushedListingIds,
        criteria: widened.criteria,
        priceMin: widened.priceMin,
        priceMax: widened.priceMax,
        petNote: "",
        mode: "similar",
      };
      // 依該物件條件寫入／更新客人找房需求，之後新案可推播
      if (fallbackLineUserId) {
        void upsertGuestWatchCriteria({
          lineUserId: fallbackLineUserId,
          displayName: lineProfile?.displayName ?? undefined,
          criteria: widened.criteria,
          priceMin: widened.priceMin,
          priceMax: widened.priceMax,
          active: true,
        }).catch((error) => {
          console.warn("[liff/rent-assistant] seed watch failed", error);
        });
      }
    }
  } else if (similarMode && fallbackLineUserId) {
    // 非官網物件（591／截圖）：用剛存的條件直接列類似物件
    const watch = await getGuestWatchByUserId(fallbackLineUserId);
    if (watch) {
      directListing = {
        listingIds: [],
        criteria: watchRecordToCriteria(watch),
        priceMin: watch.priceMin ?? null,
        priceMax: watch.priceMax ?? null,
        petNote: watch.petNote ?? "",
        mode: "similar",
      };
    }
  } else if (pushedListingIds.length) {
    // 591／推播／照片「選看屋時間」：直接開該物件；有舊條件就帶上。
    const watch = fallbackLineUserId
      ? await getGuestWatchByUserId(fallbackLineUserId)
      : null;
    directListing = {
      listingIds: pushedListingIds,
      criteria: watch ? watchRecordToCriteria(watch) : emptyCriteria(),
      priceMin: watch?.priceMin ?? null,
      priceMax: watch?.priceMax ?? null,
      petNote: watch?.petNote ?? "",
      mode: "book",
    };
  }

  const listingBaseUrl =
    process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
    "https://house-platform.vercel.app";

  return (
    <LineLiffRentAssistant
      listings={cards}
      liffId={liffId}
      listingBaseUrl={listingBaseUrl}
      fallbackLineUserId={fallbackLineUserId}
      initialDisplayName={lineProfile?.displayName ?? null}
      directListing={directListing}
    />
  );
}
