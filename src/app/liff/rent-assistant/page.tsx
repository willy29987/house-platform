import { ListingType } from "@prisma/client";
import { LineLiffRentAssistant } from "@/components/line-liff-rent-assistant";
import { LineLiffRentPickClient } from "@/components/line-liff-rent-pick-client";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import { getLineAccountLink } from "@/lib/line-official-account";
import { getListings } from "@/lib/listings";
import { toRentalMatchListing } from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";

export default async function LiffRentAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ liffId?: string; mode?: string; session?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode?.trim() ?? "";
  const sessionId = params.session?.trim() ?? "";
  const liffId = params.liffId?.trim() || LINE_LIFF_RENT_ASSISTANT_ID;

  if (mode === "pick" && sessionId) {
    return <LineLiffRentPickClient sessionId={sessionId} liffId={liffId} />;
  }

  const [listings, lineAccount] = await Promise.all([
    getListings({ listingType: ListingType.RENT }),
    getLineAccountLink(),
  ]);
  const cards = listings.map(toRentalMatchListing);

  return (
    <LineLiffRentAssistant
      listings={cards}
      lineBasicId={lineAccount.basicId}
      liffId={liffId}
    />
  );
}
