import { ListingType } from "@prisma/client";
import { redirect } from "next/navigation";
import { LineRentalPreview } from "@/components/line-rental-preview";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getLineAccountLink } from "@/lib/line-official-account";
import { getListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [listings, lineAccount] = await Promise.all([
    getListings({ listingType: ListingType.RENT }),
    getLineAccountLink(),
  ]);
  const cards = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    city: listing.city,
    district: listing.district,
    price: listing.price,
    rooms: listing.rooms,
    bathrooms: listing.bathrooms,
    areaParkingSpace: listing.areaParkingSpace,
    coverImage: listing.coverImage,
    rentSubsidy: listing.rentSubsidy,
    taxDeductible: listing.taxDeductible,
    canRegisterAddress: listing.canRegisterAddress,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4">
        <p className="text-sm text-zinc-600">租屋客服</p>
        <h1 className="text-2xl font-bold text-zinc-900">客人名單</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600">
          回訊方式跟官方 LINE 一樣。下面先用示範客人看版面，傳出去的字只留在這頁。
        </p>
      </div>
      <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {lineAccount.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineAccount.pictureUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#06c755] text-sm font-bold text-white">
                LINE
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-950">官方帳號已接上 · 回覆尚未上線</p>
              <p className="truncate text-base font-bold text-zinc-900">
                {lineAccount.displayName || "網站上的官方帳號"} {lineAccount.basicId}
              </p>
            </div>
          </div>
          {lineAccount.addFriendUrl ? (
            <a
              href={lineAccount.addFriendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#067a36]"
            >
              在 LINE 打開
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          這是網站上正在用的官方帳號。還沒打開 LINE 的訊息接收，所以不會改你現在的自動回覆，這頁打的字也不會進客人的 LINE。名單仍是示範。
        </p>
      </section>
      <LineRentalPreview listings={cards} lineBasicId={lineAccount.basicId} />
    </div>
  );
}
