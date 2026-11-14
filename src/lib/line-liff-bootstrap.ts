import "server-only";

import {
  getGuestWatchByUserId,
  upsertGuestWatchCriteria,
  watchRecordToCriteria,
} from "@/lib/line-guest-watch";
import { getGuestNewListingIds } from "@/lib/line-guest-rich-menu";
import { liffStateParams, messagingUidFromSearch } from "@/lib/line-liff-id";
import { getLineUserProfile } from "@/lib/line-messaging";
import { findLatestOpenViewing } from "@/lib/line-rental-cases";
import {
  emptyCriteria,
  loadPublishedRentalMatchListing,
  loadRentalMatchListings,
  widenCriteriaFromListing,
  type LiffDirectListingEntry,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";

export type LiffBootstrapPayload = {
  listings: RentalMatchListing[];
  fallbackLineUserId: string | null;
  initialDisplayName: string | null;
  directListing: LiffDirectListingEntry | null;
};

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

export async function buildLiffBootstrap(input: {
  uid?: string;
  listingId?: string | string[];
  similar?: string | string[];
  fresh?: string | string[];
  "liff.state"?: string;
}): Promise<LiffBootstrapPayload> {
  const search = new URLSearchParams();
  if (input.uid) search.set("uid", input.uid);
  if (input["liff.state"]) search.set("liff.state", input["liff.state"]);
  const fallbackLineUserId = messagingUidFromSearch(search.toString());
  const stateParams = liffStateParams(input["liff.state"]);
  const directIds = listingIdsFromParam(input.listingId);
  const pushedListingIds = directIds.length
    ? directIds
    : listingIdsFromParam(stateParams.getAll("listingId"));
  const similarMode = truthyParam(input.similar ?? stateParams.get("similar") ?? undefined);
  const freshMode =
    Boolean(fallbackLineUserId) &&
    truthyParam(input.fresh ?? stateParams.get("fresh") ?? undefined);

  const [openViewing, lineProfile, freshIds] = await Promise.all([
    fallbackLineUserId ? findLatestOpenViewing(fallbackLineUserId) : Promise.resolve(null),
    fallbackLineUserId ? getLineUserProfile(fallbackLineUserId) : Promise.resolve(null),
    freshMode && fallbackLineUserId
      ? getGuestNewListingIds(fallbackLineUserId)
      : Promise.resolve([] as string[]),
  ]);
  const priorListingIds = openViewing?.picked.map((item) => item.id) ?? [];

  // 限制筆數，避免一次撈全庫拖慢 LIFF
  const cards = await loadRentalMatchListings(80, [
    ...pushedListingIds,
    ...priorListingIds,
    ...freshIds,
  ]);

  let directListing: LiffDirectListingEntry | null = null;

  if (freshMode && fallbackLineUserId) {
    const watch = await getGuestWatchByUserId(fallbackLineUserId);
    directListing = {
      listingIds: freshIds.filter((id) => cards.some((item) => item.id === id)),
      criteria: watch ? watchRecordToCriteria(watch) : emptyCriteria(),
      priceMin: watch?.priceMin ?? null,
      priceMax: watch?.priceMax ?? null,
      petNote: watch?.petNote ?? "",
      mode: "fresh",
    };
  } else if (pushedListingIds.length && similarMode) {
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
      if (fallbackLineUserId) {
        void upsertGuestWatchCriteria({
          lineUserId: fallbackLineUserId,
          displayName: lineProfile?.displayName ?? undefined,
          criteria: widened.criteria,
          priceMin: widened.priceMin,
          priceMax: widened.priceMax,
          active: true,
        }).catch((error) => {
          console.warn("[liff-bootstrap] seed watch failed", error);
        });
      }
    }
  } else if (similarMode && fallbackLineUserId) {
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
    const watch = fallbackLineUserId ? await getGuestWatchByUserId(fallbackLineUserId) : null;
    directListing = {
      listingIds: pushedListingIds,
      criteria: watch ? watchRecordToCriteria(watch) : emptyCriteria(),
      priceMin: watch?.priceMin ?? null,
      priceMax: watch?.priceMax ?? null,
      petNote: watch?.petNote ?? "",
      mode: "book",
    };
  }

  return {
    listings: cards,
    fallbackLineUserId,
    initialDisplayName: lineProfile?.displayName ?? null,
    directListing,
  };
}
