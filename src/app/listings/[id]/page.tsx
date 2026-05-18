import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingHistoryBack } from "@/components/listing-history-back";
import { ListingGallery } from "@/components/listing-gallery";
import { ListingShareActions } from "@/components/listing-share-actions";
import { getListingById, maskAddress } from "@/lib/listings";
import { getMrtBadgeClass, shortMrtLine } from "@/lib/mrt";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

const propertyTypeLabel: Record<string, string> = {
  APARTMENT: "大樓",
  HOUSE: "透天",
  STUDIO: "套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

const parkingTypeLabel: Record<string, string> = {
  FLAT_RAMP: "坡道平面",
  MECHANICAL_LIFT: "機械升降",
  MECHANICAL_FLAT: "機械平面",
  RAMP_MECHANICAL: "坡道機械",
  FRONT_DOOR: "門口可停車",
  OTHER: "其他",
};

function formatSalePrice(price: number) {
  if (price >= 100_000_000) {
    const yi = price / 100_000_000;
    return {
      main: yi.toFixed(yi % 1 === 0 ? 0 : 2),
      unit: "億",
    };
  }
  const wan = price / 10_000;
  return {
    main: wan.toLocaleString("zh-TW", { maximumFractionDigits: 2 }),
    unit: "萬",
  };
}

function isExternalVideo(url: string) {
  return /^https?:\/\//.test(url);
}

function toEmbedUrl(url: string) {
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return url;
}

function formatPing(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(2)} 坪`;
}

function formatBuildingAge(age: number | null | undefined) {
  if (age == null) return "—";
  return `${Number.isInteger(age) ? age : age.toFixed(1)} 年`;
}

function saleParkingPriceSuffix(parkingIncluded: boolean | null, parkingPrice: number | null) {
  if (parkingIncluded === true) return "（含總價）";
  if (parkingPrice != null && parkingPrice > 0) {
    const { main, unit } = formatSalePrice(parkingPrice);
    return `（${main}${unit}元）`;
  }
  if (parkingIncluded === false) return "（另計）";
  return null;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const displayAddress = maskAddress(listing.address);
  const mapQuery = encodeURIComponent(`${listing.city}${listing.district}${displayAddress}`);
  const mapUrl = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;

  const features = (listing.features ?? []).filter(Boolean);
  const isRent = listing.listingType === "RENT";

  const hasParking =
    Boolean(listing.parkingType) ||
    Boolean(listing.parkingSpaceInfo) ||
    Boolean(listing.parkingRent) ||
    Boolean(listing.areaParkingSpace) ||
    Boolean(listing.parkingPrice) ||
    listing.parkingIncluded === true;

  const saleParkingSuffix = !isRent
    ? saleParkingPriceSuffix(listing.parkingIncluded, listing.parkingPrice)
    : null;

  const buildingAreaTotalText = (() => {
    const m = listing.areaMain;
    const a = listing.areaAncillary;
    if (m != null && a != null) {
      const total = m + a;
      const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
      return `${formatted} 坪`;
    }
    if (m != null) return `${m} 坪`;
    if (a != null) return `${a} 坪`;
    return "—";
  })();

  const floorText =
    listing.floor != null && listing.totalFloors != null
      ? `${listing.floor} / ${listing.totalFloors} F`
      : listing.floor != null
        ? `${listing.floor} F`
        : listing.totalFloors != null
          ? `共 ${listing.totalFloors} F`
          : "—";

  const orientationText = listing.orientation?.trim() ? listing.orientation : "—";

  const layoutText = [
    `${listing.rooms}房`,
    listing.livingRooms != null ? `${listing.livingRooms}廳` : null,
    `${listing.bathrooms}衛`,
    listing.balconies != null ? `${listing.balconies}陽台` : null,
  ]
    .filter(Boolean)
    .join("");
  const conditionItems = [
    listing.petsAllowed === true ? { label: "養寵物", value: "可以" } : null,
    listing.taxDeductible === true ? { label: "報稅", value: "可以" } : null,
    listing.rentSubsidy === true ? { label: "租屋補助", value: "可以" } : null,
    listing.canRegisterAddress === true ? { label: "入戶籍", value: "可以" } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);
  const mrtBadgeClass = getMrtBadgeClass(listing.mrtLine);
  const mrtLine = shortMrtLine(listing.mrtLine);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <ListingHistoryBack />
        <FavoriteButton listingId={listing.id} />
      </div>

      <section className="mb-6">
        <ListingGallery title={listing.title} coverImage={listing.coverImage} images={listing.images ?? []} />
      </section>

      <section className="space-y-6">
        {/* ============== 標題區 ============== */}
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
          <h1 className="text-left text-2xl font-extrabold leading-snug tracking-tight text-zinc-900 sm:text-[1.65rem] sm:leading-tight">
            {listing.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-start gap-x-2 gap-y-1.5 text-left">
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold sm:px-3 sm:py-1 sm:text-sm ${
                isRent ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {isRent ? "出租" : "買賣"}
            </span>
            <span className="text-sm font-semibold text-zinc-800 sm:text-[0.95rem]">
              {listing.city}
              {listing.district}
            </span>
            {displayAddress ? (
              <span className="min-w-0 max-w-full text-sm text-zinc-600 sm:text-[0.95rem]">
                <span className="mr-0.5" aria-hidden>
                  📍
                </span>
                <span className="break-words">{displayAddress}</span>
              </span>
            ) : null}
            {listing.mrtStation ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold text-white sm:px-2.5 sm:py-1 sm:text-sm ${mrtBadgeClass}`}
              >
                🚇 {listing.mrtStation}
                {mrtLine ? <span className="font-medium opacity-90">· {mrtLine}</span> : null}
              </span>
            ) : null}
          </div>

          {listing.community ? (
            <p className="mt-2 text-left text-base font-semibold text-zinc-600 sm:text-lg">🏢 {listing.community}</p>
          ) : null}

          {/* 藍框：月租／售價＋管理費；有車位才顯示車位列 */}
          <div className="mt-4 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] px-4 py-2.5 text-white shadow-md sm:px-5 sm:py-3">
            <div className={hasParking ? "border-b border-white/20 pb-2" : undefined}>
              {isRent ? (
                <BluePriceSplitRow
                  left={{
                    label: "月租",
                    value: (
                      <>
                        {listing.price.toLocaleString("zh-TW")}
                        <span className="ml-0.5 text-[0.6rem] font-semibold text-white/85 sm:text-[0.65rem]">/ 月</span>
                      </>
                    ),
                  }}
                  right={{
                    label: "管理費",
                    value: listing.managementFee ? (
                      <>
                        {listing.managementFee.toLocaleString("zh-TW")}
                        <span className="ml-0.5 text-[0.6rem] font-semibold text-white/85 sm:text-[0.65rem]">/ 月</span>
                      </>
                    ) : (
                      "免管理費"
                    ),
                  }}
                />
              ) : (
                <BluePriceSplitRow
                  left={{
                    label: "售價",
                    value: (
                      <>
                        {(() => {
                          const { main, unit } = formatSalePrice(listing.price);
                          return (
                            <>
                              {main}
                              <span className="ml-0.5 text-[0.6rem] font-semibold text-white/85 sm:text-[0.65rem]">{unit}元</span>
                            </>
                          );
                        })()}
                        {listing.areaPing ? (
                          <span className="mt-0.5 block text-[0.6rem] font-normal text-white/80 sm:text-[0.65rem]">
                            單價約 {(listing.price / 10_000 / listing.areaPing).toFixed(2)} 萬 / 坪
                          </span>
                        ) : null}
                      </>
                    ),
                  }}
                  right={{
                    label: "管理費",
                    value: listing.managementFee ? (
                      <>
                        {listing.managementFee.toLocaleString("zh-TW")}
                        <span className="ml-0.5 text-[0.6rem] font-semibold text-white/85 sm:text-[0.65rem]">/ 月</span>
                      </>
                    ) : (
                      "免管理費"
                    ),
                  }}
                />
              )}
            </div>

            {hasParking ? (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2">
                <p className="min-w-0 text-sm leading-snug text-white sm:text-[0.95rem]">
                  <span className="text-[0.65rem] font-semibold text-white/80 sm:text-xs">車位</span>
                  <span className="mx-1.5 text-white/40">·</span>
                  <span className="font-semibold tracking-tight">
                    {listing.parkingType ? parkingTypeLabel[listing.parkingType] ?? listing.parkingType : "有車位"}
                  </span>
                  {saleParkingSuffix ? (
                    <span className="ml-1.5 text-xs font-normal text-white/85 sm:text-sm">{saleParkingSuffix}</span>
                  ) : null}
                </p>
                {isRent && listing.parkingRent ? (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-white sm:text-base">
                    {listing.parkingRent.toLocaleString("zh-TW")} / 月
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ============== 物件資訊（左）＋ 租賃條件（右，桌機並排） ============== */}
          <div
            className={`mt-6 grid gap-6 text-left md:gap-8 ${isRent && conditionItems.length > 0 ? "md:grid-cols-2 md:items-start" : ""}`}
          >
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-zinc-900 sm:text-xl">
                <span className="inline-block h-5 w-1 rounded-full bg-[#0b2545] sm:h-6 sm:w-1.5" />
                物件資訊
              </h2>
              <div className="flex flex-col">
                <InfoLayoutRow value={layoutText} />
                {!isRent ? (
                  <>
                    <InfoRowPair
                      left={{ label: "權狀坪數", value: `${listing.areaPing} 坪` }}
                      right={{ label: "主建物", value: formatPing(listing.areaMain) }}
                    />
                    <InfoRowPair
                      left={{ label: "附屬建物", value: formatPing(listing.areaAncillary) }}
                      right={{ label: "公設坪數", value: formatPing(listing.areaCommon) }}
                    />
                    <InfoRowPair
                      left={{ label: "車位坪數", value: formatPing(listing.areaParkingSpace) }}
                      right={{ label: "土地坪數", value: formatPing(listing.areaLand) }}
                    />
                    <InfoRowPair
                      left={{ label: "屋齡", value: formatBuildingAge(listing.buildingAge) }}
                      right={{ label: "樓層", value: floorText }}
                    />
                    <InfoRowPair
                      left={{ label: "型態", value: propertyTypeLabel[listing.propertyType] ?? listing.propertyType }}
                      right={{ label: "法定用途", value: listing.legalUsage?.trim() || "—" }}
                    />
                    <InfoRowPair left={{ label: "朝向", value: orientationText }} />
                  </>
                ) : (
                  <>
                    <InfoRowPair
                      left={{ label: "權狀坪數", value: `${listing.areaPing} 坪` }}
                      right={{ label: "主＋附屬(建物)", value: buildingAreaTotalText }}
                    />
                    <InfoRowPair
                      left={{ label: "型態", value: propertyTypeLabel[listing.propertyType] ?? listing.propertyType }}
                      right={{ label: "樓層", value: floorText }}
                    />
                    <InfoRowPair left={{ label: "朝向", value: orientationText }} />
                  </>
                )}
              </div>
            </div>

            {isRent && conditionItems.length > 0 ? (
              <div className="border-t border-zinc-100 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0 lg:pl-8">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-zinc-900 sm:text-xl">
                  <span className="inline-block h-5 w-1 rounded-full bg-[#0b2545] sm:h-6 sm:w-1.5" />
                  租賃條件
                </h2>
                <div
                  className={
                    conditionItems.length >= 2
                      ? "grid grid-cols-2 gap-2 sm:gap-2.5"
                      : "grid grid-cols-1 gap-2"
                  }
                >
                  {conditionItems.map((item) => (
                    <InfoBlock key={item.label} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ============== 實景影片 ============== */}
        {listing.videoUrl ? (
          <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
              實景影片
            </h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              {isExternalVideo(listing.videoUrl) && /youtube|youtu\.be/.test(listing.videoUrl) ? (
                <iframe
                  src={toEmbedUrl(listing.videoUrl)}
                  title="listing-video"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={listing.videoUrl} controls className="h-full w-full object-cover" />
              )}
            </div>
          </div>
        ) : null}

        {/* ============== 物件特色 ============== */}
        {features.length > 0 ? (
          <div className="rounded-2xl bg-gradient-to-br from-zinc-50 to-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
            <h2 className="mb-2.5 flex items-center gap-2 text-lg font-bold text-zinc-900 sm:mb-3 sm:text-xl">
              <span className="inline-block h-5 w-1 rounded-full bg-[#0b2545] sm:w-1.5" />
              物件特色
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3">
              {features.map((feature, i) => (
                <div
                  key={`${feature}-${i}`}
                  className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white px-3 py-2.5 transition-all hover:border-[#0b2545] hover:shadow-sm sm:px-3.5 sm:py-3"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm leading-snug text-zinc-800">{feature}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ============== 地圖 ============== */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-zinc-900">
            <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
            地圖位置
          </h2>
          <iframe
            title="listing-map"
            src={mapUrl}
            className="h-[13.333rem] w-full rounded-xl border border-zinc-200"
            loading="lazy"
          />
        </div>

        <ListingShareActions title={listing.title} />
      </section>
    </main>
  );
}



function BluePriceSplitRow({
  left,
  right,
}: {
  left: { label: string; value: ReactNode };
  right: { label: string; value: ReactNode };
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-x-3 sm:gap-x-4">
      <div className="min-w-0 text-right">
        <p className="text-[0.65rem] font-semibold tracking-wide text-white/80 sm:text-xs">{left.label}</p>
        <p className="mt-0.5 text-sm font-extrabold tabular-nums leading-none tracking-tight sm:text-base">{left.value}</p>
      </div>
      <div className="h-9 w-px self-center bg-white/25 sm:h-10" aria-hidden />
      <div className="min-w-0 text-right">
        <p className="text-[0.65rem] font-semibold tracking-wide text-white/80 sm:text-xs">{right.label}</p>
        <p className="mt-0.5 text-sm font-extrabold tabular-nums leading-none sm:text-base">{right.value}</p>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <p className="text-[11px] text-zinc-500 sm:text-xs">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-zinc-900 sm:text-sm">{value}</p>
    </div>
  );
}

/** 格局專用列：標籤靠左、房廳衛陽台靠右，字級略大、字距稍開 */
function InfoLayoutRow({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5 sm:py-3">
      <span className="shrink-0 text-xs font-medium text-zinc-500 sm:text-[13px]">格局</span>
      <p className="flex min-w-0 flex-wrap justify-end gap-x-0.5 gap-y-0.5 text-base font-bold leading-relaxed text-zinc-900 sm:gap-x-1 sm:text-lg">
        {value.split("").map((char, i) => (
          <span key={`${char}-${i}`} className="inline-block">
            {char}
          </span>
        ))}
      </p>
    </div>
  );
}

function InfoRowPair({
  left,
  right,
}: {
  left: { label: string; value: string };
  right?: { label: string; value: string };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 py-1.5 sm:gap-6 sm:py-2">
      <InfoRowCell label={left.label} value={left.value} />
      {right ? <InfoRowCell label={right.label} value={right.value} /> : null}
    </div>
  );
}

function InfoRowCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="text-xs font-medium text-zinc-500 sm:text-[13px]">{label}</span>
      <span className="text-right text-sm font-bold text-zinc-900 sm:text-[15px]">{value}</span>
    </div>
  );
}
