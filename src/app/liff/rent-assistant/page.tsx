import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import type { LiffDirectListingEntry } from "@/components/line-liff-rent-form";
import { getGuestWatchByUserId, watchRecordToCriteria } from "@/lib/line-guest-watch";
import { LINE_LIFF_RENT_ASSISTANT_ID, messagingUidFromSearch } from "@/lib/line-liff-id";
import { getLineUserProfile } from "@/lib/line-messaging";
import { findLatestOpenViewing } from "@/lib/line-rental-cases";
import { emptyCriteria, loadRentalMatchListings } from "@/lib/line-rental-assistant";

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
  // 591／推播帶 listingId 時直接開該物件；有舊條件就帶上，沒有也不擋。
  if (pushedListingIds.length) {
    const watch = fallbackLineUserId
      ? await getGuestWatchByUserId(fallbackLineUserId)
      : null;
    directListing = {
      listingIds: pushedListingIds,
      criteria: watch ? watchRecordToCriteria(watch) : emptyCriteria(),
      priceMin: watch?.priceMin ?? null,
      priceMax: watch?.priceMax ?? null,
      petNote: watch?.petNote ?? "",
    };
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
