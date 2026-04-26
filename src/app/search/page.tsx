import { ListingType } from "@prisma/client";
import Link from "next/link";
import { getListings } from "@/lib/listings";
import { ListingCardItem } from "@/components/listing-card";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const keyword = (params.q ?? "").trim();
  const typeParam = params.type === "RENT" || params.type === "SALE" ? params.type : null;

  const listings = keyword
    ? await getListings({
        keyword,
        listingType:
          typeParam === "RENT"
            ? ListingType.RENT
            : typeParam === "SALE"
              ? ListingType.SALE
              : undefined,
      })
    : [];

  const rentCount = listings.filter((l) => l.listingType === "RENT").length;
  const saleCount = listings.filter((l) => l.listingType === "SALE").length;

  const baseHref = `/search?q=${encodeURIComponent(keyword)}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        {keyword ? (
          <>
            <p className="text-sm text-zinc-500">搜尋關鍵字</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              「{keyword}」<span className="ml-3 text-base font-medium text-zinc-500">共 {listings.length} 筆結果</span>
            </h1>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-zinc-900">開始搜尋</h1>
            <p className="mt-1 text-sm text-zinc-500">
              在上方搜尋列輸入地區、社區、關鍵字，開始瀏覽房源。
            </p>
          </>
        )}
      </div>

      {keyword ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200">
            <TabLink href={baseHref} active={!typeParam} label={`全部（${listings.length}）`} />
            <TabLink
              href={`${baseHref}&type=RENT`}
              active={typeParam === "RENT"}
              label={`租賃（${rentCount}）`}
            />
            <TabLink
              href={`${baseHref}&type=SALE`}
              active={typeParam === "SALE"}
              label={`買賣（${saleCount}）`}
            />
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 p-12 text-center">
              <p className="text-base font-medium text-zinc-700">
                沒有符合「{keyword}」的物件
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                試試其他關鍵字，或直接回首頁瀏覽精選物件
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-lg bg-[#0b2545] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
              >
                回首頁
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {listings.map((listing) => (
                <ListingCardItem key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-[#0b2545] text-[#0b2545]"
          : "border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      {label}
    </Link>
  );
}
