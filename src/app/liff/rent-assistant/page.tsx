import { ListingType } from "@prisma/client";
import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import { getListings } from "@/lib/listings";
import { toRentalMatchListing } from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ liffId?: string }>;
}) {
  const params = await searchParams;
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;

  const listings = await getListings({ listingType: ListingType.RENT });
  const cards = listings.map(toRentalMatchListing);

  // 一律一頁式表單（不再走對話／mode=pick）
  return <LineLiffRentAssistant listings={cards} liffId={liffId} />;
}
