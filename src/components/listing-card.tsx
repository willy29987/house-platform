import Image from "next/image";
import Link from "next/link";
import { ListingCardFavorite } from "@/components/listing-card-favorite";
import { maskAddress, type ListingCard as ListingCardType } from "@/lib/listings";
import { getMrtBadgeClass, shortMrtLine } from "@/lib/mrt";
import { propertyTypeLabel } from "@/lib/property-type-label";

function formatPrice(price: number, type: "RENT" | "SALE") {
  if (type === "RENT") {
    return {
      main: price.toLocaleString("zh-TW"),
      unit: "/月",
      prefix: "NT$",
    };
  }
  if (price >= 100_000_000) {
    const yi = price / 100_000_000;
    return {
      main: yi.toFixed(yi % 1 === 0 ? 0 : 2),
      unit: "億",
      prefix: "",
    };
  }
  const wan = price / 10_000;
  return {
    main: wan.toLocaleString("zh-TW", { maximumFractionDigits: 2 }),
    unit: "萬",
    prefix: "",
  };
}

function formatLayout(rooms: number, livingRooms: number | null, bathrooms: number, balconies: number | null) {
  return [
    `${rooms}房`,
    livingRooms != null ? `${livingRooms}廳` : null,
    `${bathrooms}衛`,
    balconies ? `${balconies}陽台` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function getCoverImage(listing: ListingCardType) {
  if (listing.coverImage) return listing.coverImage;
  return `https://picsum.photos/seed/${listing.id}/600/400`;
}

type Props = {
  listing: ListingCardType;
  className?: string;
};

export function ListingCardItem({ listing, className = "" }: Props) {
  const isRent = listing.listingType === "RENT";
  const price = formatPrice(listing.price, listing.listingType);
  const layout = formatLayout(
    listing.rooms,
    listing.livingRooms,
    listing.bathrooms,
    listing.balconies,
  );
  const hasParking = (listing.areaParkingSpace ?? 0) > 0;

  const mrtStation = listing.mrtStation?.trim();
  const mrtLine = shortMrtLine(listing.mrtLine);
  const mrtBadgeClass = getMrtBadgeClass(listing.mrtLine);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-zinc-300 ${className}`}
    >
      {/* 封面圖：固定較矮的橫幅，每張卡片同一高度 */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
        <Image
          src={getCoverImage(listing)}
          alt={listing.title}
          fill
          className="object-cover object-center"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <ListingCardFavorite listingId={listing.id} />
      </div>

      {/* 內容：不 stretch，避免輪播等高時底部留白 */}
      <div className="flex flex-col px-3.5 pb-3 pt-3">
        <h3 className="line-clamp-1 text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
          {listing.title}
        </h3>

        {/* 捷運列；有車位時車位標籤固定在最右 */}
        {mrtStation || hasParking ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {mrtStation ? (
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold text-white ${mrtBadgeClass}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M12 2C8 2 4 2.5 4 6v9.5a3.5 3.5 0 003.5 3.5L6 21h2l1.5-2h5L16 21h2l-1.5-2a3.5 3.5 0 003.5-3.5V6c0-3.5-4-4-8-4zm-4.5 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3.5-6H6V6h5.5v5zm1 0V6H18v5h-5.5zm3.5 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                  </svg>
                  <span className="truncate">
                    {mrtStation}
                    {mrtLine ? <span className="font-normal opacity-85"> · {mrtLine}</span> : null}
                  </span>
                </span>
              ) : null}
            </div>
            {hasParking ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-bold text-emerald-700">
                🚗 有車位
              </span>
            ) : null}
          </div>
        ) : null}

        {/* 地址 */}
        <p className="mt-1.5 line-clamp-1 text-[15px] text-zinc-600 sm:text-base">
          <span className="mr-1 text-zinc-400">📍</span>
          {listing.city}{listing.district} {maskAddress(listing.address)}
        </p>

        {/* 坪數 / 格局 */}
        <p className="mt-1 text-[15px] text-zinc-800 sm:text-base">
          <span className="mr-1 text-zinc-400">🏠</span>
          <span className="font-semibold">{listing.areaPing}坪</span>
          <span className="mx-1.5 text-zinc-300">·</span>
          <span className="font-semibold">{layout}</span>
        </p>

        {/* 社區／車位與價格同一列（省一列高度） */}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t border-zinc-100 pt-1.5 pb-0">
          <span className="min-w-0 flex-1 line-clamp-1 text-[15px] font-semibold text-zinc-700 sm:text-base">
            🏢 {listing.community || propertyTypeLabel(listing.propertyType)}
          </span>
          <div
            className={`flex shrink-0 items-baseline gap-0.5 tabular-nums ${
              isRent ? "text-blue-600" : "text-rose-600"
            }`}
          >
            {price.prefix ? (
              <span className="text-xs font-bold sm:text-sm">{price.prefix}</span>
            ) : null}
            <span className="text-xl font-extrabold leading-none tracking-tight sm:text-2xl">{price.main}</span>
            <span className="text-sm font-bold sm:text-base">{price.unit}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
