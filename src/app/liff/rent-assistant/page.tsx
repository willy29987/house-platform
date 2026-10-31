import { ListingType } from "@prisma/client";
import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { getLineAccountLink } from "@/lib/line-official-account";
import { getListings } from "@/lib/listings";
import { toRentalMatchListing } from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";

export default async function LiffRentAssistantPage() {
  const [listings, lineAccount] = await Promise.all([
    getListings({ listingType: ListingType.RENT }),
    getLineAccountLink(),
  ]);
  const cards = listings.map(toRentalMatchListing);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() ?? "";

  return (
    <LineLiffRentAssistant
      listings={cards}
      lineBasicId={lineAccount.basicId}
      liffId={liffId}
    />
  );
}
