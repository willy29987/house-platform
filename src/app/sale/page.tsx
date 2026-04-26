import { ListingType } from "@prisma/client";
import { Suspense } from "react";
import { getListings } from "@/lib/listings";
import { ListingsBrowser } from "@/components/listings-browser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "買好房 | 不動產實踐家",
  description: "從小宅到豪宅，找到最適合你的家",
};

export default async function SalePage() {
  const listings = await getListings({ listingType: ListingType.SALE });
  return (
    <Suspense>
      <ListingsBrowser listingType="SALE" listings={listings} />
    </Suspense>
  );
}
