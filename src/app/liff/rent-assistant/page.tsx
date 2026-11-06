import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { getLineUserProfile } from "@/lib/line-messaging";
import { getGuestWatchByUserId, watchRecordToCriteria } from "@/lib/line-guest-watch";
import { findLatestOpenViewing } from "@/lib/line-rental-cases";
import { LINE_LIFF_RENT_ASSISTANT_ID, messagingUidFromSearch } from "@/lib/line-liff-id";
import { loadRentalMatchListings } from "@/lib/line-rental-assistant";
import type { LiffDirectListingEntry } from "@/components/line-liff-rent-form";

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

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{
    liffId?: string;
    uid?: string;
    listingId?: string | string[];
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
  const openViewing = fallbackLineUserId
    ? await findLatestOpenViewing(fallbackLineUserId)
    : null;
  const priorListingIds = openViewing?.picked.map((item) => item.id) ?? [];

  const cards = await loadRentalMatchListings(null, [...pushedListingIds, ...priorListingIds]);
  let directListing: LiffDirectListingEntry | null = null;
  if (fallbackLineUserId && pushedListingIds.length) {
    const watch = await getGuestWatchByUserId(fallbackLineUserId);
    if (watch) {
      directListing = {
        listingIds: pushedListingIds,
        criteria: watchRecordToCriteria(watch),
        priceMin: watch.priceMin,
        priceMax: watch.priceMax,
        petNote: watch.petNote,
      };
    }
  }
  const listingBaseUrl =
    process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
    "https://house-platform.vercel.app";
  const lineProfile = fallbackLineUserId ? await getLineUserProfile(fallbackLineUserId) : null;

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
