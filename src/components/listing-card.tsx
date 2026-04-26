import Image from "next/image";
import Link from "next/link";
import { maskAddress, type ListingCard as ListingCardType } from "@/lib/listings";

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

function shortLine(line: string | null) {
  if (!line) return null;
  const parts = line.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : line;
}

function getMrtBadgeClass(line: string | null) {
  if (!line) return "bg-orange-500";
  if (line.includes("文湖")) return "bg-amber-700";
  if (line.includes("淡水信義")) return "bg-red-600";
  if (line.includes("松山新店")) return "bg-green-600";
  if (line.includes("中和新蘆")) return "bg-orange-600";
  if (line.includes("板南")) return "bg-blue-600";
  if (line.includes("環狀")) return "bg-yellow-400";
  if (line.includes("淡海")) return "bg-cyan-600";
  if (line.includes("安坑")) return "bg-lime-600";
  if (line.includes("桃園") || line.includes("機場")) return "bg-purple-600";
  if (line.includes("台中")) return "bg-emerald-600";
  if (line.includes("高雄") && line.includes("紅")) return "bg-red-600";
  if (line.includes("高雄") && line.includes("橘")) return "bg-orange-600";
  return "bg-orange-500";
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
  const mrtLine = shortLine(listing.mrtLine);
  const mrtBadgeClass = getMrtBadgeClass(listing.mrtLine);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-zinc-300 ${className}`}
    >
      {/* 封面圖 */}
      <div
        className="relative w-full overflow-hidden bg-zinc-100"
        style={{ aspectRatio: "4 / 3" }}
      >
        <Image
          src={getCoverImage(listing)}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-zinc-700 shadow-sm backdrop-blur-sm transition group-hover:text-amber-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
          </svg>
        </span>
      </div>

      {/* 內容 */}
      <div className="flex flex-1 flex-col px-3.5 pb-3 pt-2.5">
        <h3 className="line-clamp-1 text-[17px] font-bold leading-tight text-zinc-900">
          {listing.title}
        </h3>

        {/* 捷運（有才顯示，不再 fallback 到區域+物件類型） */}
        {mrtStation ? (
          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold text-white ${mrtBadgeClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8 2 4 2.5 4 6v9.5a3.5 3.5 0 003.5 3.5L6 21h2l1.5-2h5L16 21h2l-1.5-2a3.5 3.5 0 003.5-3.5V6c0-3.5-4-4-8-4zm-4.5 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3.5-6H6V6h5.5v5zm1 0V6H18v5h-5.5zm3.5 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
              </svg>
              {mrtStation}
              {mrtLine ? <span className="font-normal opacity-85"> · {mrtLine}</span> : null}
            </span>
          </div>
        ) : null}

        {/* 地址 */}
        <p className="mt-1 line-clamp-1 text-[13.5px] text-zinc-600">
          <span className="mr-1 text-zinc-400">📍</span>
          {listing.city}{listing.district} {maskAddress(listing.address)}
        </p>

        {/* 坪數 / 格局 */}
        <p className="mt-0.5 text-[14px] text-zinc-800">
          <span className="mr-1 text-zinc-400">🏠</span>
          <span className="font-semibold">{listing.areaPing}坪</span>
          <span className="mx-1.5 text-zinc-300">·</span>
          <span className="font-semibold">{layout}</span>
        </p>

        {/* 社區 / 電梯大樓 / 公寓 + 車位 */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="line-clamp-1 text-[14px] font-semibold text-zinc-700">
            🏢 {listing.community || (listing.hasElevator ? "電梯大樓" : "公寓")}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[12px] font-medium ${
              hasParking ? "text-emerald-600" : "text-zinc-400"
            }`}
          >
            🚗 {hasParking ? "有車位" : "無車位"}
          </span>
        </div>

        {/* 價格（靠右） */}
        <div className="mt-2 flex items-baseline justify-end gap-1 border-t border-zinc-100 pt-2">
          {price.prefix ? (
            <span
              className={`text-[13px] font-bold ${
                isRent ? "text-blue-600" : "text-rose-600"
              }`}
            >
              {price.prefix}
            </span>
          ) : null}
          <span
            className={`text-[22px] font-extrabold leading-none tracking-tight ${
              isRent ? "text-blue-600" : "text-rose-600"
            }`}
          >
            {price.main}
          </span>
          <span
            className={`text-[14px] font-bold ${
              isRent ? "text-blue-600" : "text-rose-600"
            }`}
          >
            {price.unit}
          </span>
        </div>
      </div>
    </Link>
  );
}
