import { ListingType } from "@prisma/client";
import { Suspense } from "react";
import { getListings } from "@/lib/listings";
import { ListingsBrowser } from "@/components/listings-browser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "找住宅 | 不動產實踐家",
  description: "篩選你的理想租屋，從地段、預算到格局一次搞定",
};

export default async function RentPage() {
  const listings = await getListings({ listingType: ListingType.RENT });
  return (
    <Suspense>
      <ListingsBrowser listingType="RENT" listings={listings} />
    </Suspense>
  );
}
