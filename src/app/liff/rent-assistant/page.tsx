import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { getGuestWatchByUserId, watchRecordToCriteria } from "@/lib/line-guest-watch";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
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
  searchParams: Promise<{ liffId?: string; uid?: string; listingId?: string | string[] }>;
}) {
  const params = await searchParams;
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;
  const fallbackLineUserId = params.uid?.trim() || null;
  const pushedListingIds = listingIdsFromParam(params.listingId);

  const cards = await loadRentalMatchListings(60, pushedListingIds);
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
  const lineBasicId =
    (
      process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL ||
      process.env.NEXT_PUBLIC_LINE_OA_URL ||
      ""
    ).match(/@[\w.-]+/)?.[0] ?? "@878thkii";

  return (
    <LineLiffRentAssistant
      listings={cards}
      liffId={liffId}
      listingBaseUrl={listingBaseUrl}
      fallbackLineUserId={fallbackLineUserId}
      lineBasicId={lineBasicId}
      directListing={directListing}
    />
  );
}
