import { ListingType } from "@prisma/client";
import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import { getListings } from "@/lib/listings";
import { toRentalMatchListing } from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ liffId?: string; uid?: string }>;
}) {
  const params = await searchParams;
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;
  const fallbackLineUserId = params.uid?.trim() || null;

  const listings = await getListings({ listingType: ListingType.RENT });
  const cards = listings.map(toRentalMatchListing);
  const listingBaseUrl =
    process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
    "https://house-platform.vercel.app";
  const lineBasicId =
    (
      process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL ||
      process.env.NEXT_PUBLIC_LINE_OA_URL ||
      ""
    ).match(/@[\w.-]+/)?.[0] ?? "@878thkii";

  // 一律多步驟表單（條件 → 物件 → 資料 → 時間）
  return (
    <LineLiffRentAssistant
      listings={cards}
      liffId={liffId}
      listingBaseUrl={listingBaseUrl}
      fallbackLineUserId={fallbackLineUserId}
      lineBasicId={lineBasicId}
    />
  );
}
