import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ListingAmenityGrid } from "@/components/listing-amenity-grid";
import { ListingHistoryBack } from "@/components/listing-history-back";
import { ListingPhotoMosaic } from "@/components/listing-photo-mosaic";
import { EQUIPMENT_ITEMS, FURNITURE_ITEMS } from "@/lib/furniture-appliance-value";
import { getListingById, maskAddress } from "@/lib/listings";
import { getMrtBadgeClass, shortMrtLine } from "@/lib/mrt";
import { PARKING_TYPE_LABELS as parkingTypeLabel } from "@/lib/parking-type-label";
import { propertyTypeLabel } from "@/lib/property-type-label";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
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

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const lineUrl =
    process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || process.env.NEXT_PUBLIC_LINE_OA_URL || null;

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

  const mrtBadgeClass = getMrtBadgeClass(listing.mrtLine);
  const mrtLine = shortMrtLine(listing.mrtLine);
  const propertyTypeText = propertyTypeLabel(listing.propertyType);
  const managementFeeText = listing.managementFee
    ? `${listing.managementFee.toLocaleString("zh-TW")} 元/月`
    : "免管理費";
  const parkingTypeText = listing.parkingType
    ? parkingTypeLabel[listing.parkingType] ?? listing.parkingType
    : "有車位";
  const parkingRentText =
    isRent && listing.parkingRent ? `${listing.parkingRent.toLocaleString("zh-TW")} 元 / 月` : null;

  const equipmentItems = listing.equipmentItems ?? [];
  const furnitureItems = listing.furnitureItems ?? [];

  const amenityGridItems = [
    ...EQUIPMENT_ITEMS.map((name) => ({ name, on: equipmentItems.includes(name) })),
    ...FURNITURE_ITEMS.map((name) => ({ name, on: furnitureItems.includes(name) })),
  ];

  const viewingMethodLabel: Record<string, string> = {
    KEY: "有鑰匙，隨時可帶看",
    OWNER_APPOINTMENT: "需約屋主時間",
  };

  function rentConditionValue(value: boolean | null | undefined): string | null {
    if (value === true) return "可以";
    if (value === false) return "不可";
    return null;
  }

  const rentConditionItems = isRent
    ? (
        [
          rentConditionValue(listing.petsAllowed)
            ? { label: "養寵物", value: rentConditionValue(listing.petsAllowed)! }
            : null,
          rentConditionValue(listing.taxDeductible)
            ? { label: "報稅", value: rentConditionValue(listing.taxDeductible)! }
            : null,
          rentConditionValue(listing.rentSubsidy)
            ? { label: "租屋補助", value: rentConditionValue(listing.rentSubsidy)! }
            : null,
          rentConditionValue(listing.canRegisterAddress)
            ? { label: "入戶籍", value: rentConditionValue(listing.canRegisterAddress)! }
            : null,
          listing.viewingMethod
            ? {
                label: "看屋方式",
                value: viewingMethodLabel[listing.viewingMethod] ?? listing.viewingMethod,
              }
            : null,
          listing.securityDeposit?.trim() ? { label: "押金", value: listing.securityDeposit.trim() } : null,
          listing.availableFrom?.trim() ? { label: "起租日", value: listing.availableFrom.trim() } : null,
          listing.shortTermRent?.trim() ? { label: "能否短租", value: listing.shortTermRent.trim() } : null,
          listing.serviceFee?.trim() ? { label: "服務費", value: listing.serviceFee.trim() } : null,
        ] as const
      ).filter((item): item is { label: string; value: string } => item !== null)
    : [];

  const lineButtonClass =
    "block rounded-lg bg-orange-500 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-orange-600";

  return (
    <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-6 sm:px-6 lg:pb-10">
      <div className="mb-3 print:hidden">
        <ListingHistoryBack />
      </div>

      {/* ============== 照片 ============== */}
      <section className="mb-6">
        <ListingPhotoMosaic title={listing.title} coverImage={listing.coverImage} images={listing.images ?? []} />
      </section>

      <div className="min-w-0">
          {/* ============== 標題 / 價格 ============== */}
          <section>
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                isRent ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              }`}
            >
              {isRent ? "出租" : "出售"}
            </span>
            <h1 className="mt-2 text-2xl font-extrabold leading-snug tracking-tight text-zinc-900 sm:text-[1.75rem]">
              {listing.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {isRent ? (
                <>
                  <span className="text-4xl font-extrabold tabular-nums tracking-tight text-red-600">
                    {listing.price.toLocaleString("zh-TW")}
                  </span>
                  <span className="text-base font-semibold text-red-600">元/月</span>
                  {listing.securityDeposit?.trim() ? (
                    <span className="text-base text-zinc-500">押金 {listing.securityDeposit.trim()}</span>
                  ) : null}
                </>
              ) : (
                <>
                  {(() => {
                    const { main, unit } = formatSalePrice(listing.price);
                    return (
                      <>
                        <span className="text-4xl font-extrabold tabular-nums tracking-tight text-red-600">{main}</span>
                        <span className="text-base font-semibold text-red-600">{unit}元</span>
                      </>
                    );
                  })()}
                  {listing.areaPing ? (
                    <span className="text-base text-zinc-500">
                      單價約 {(listing.price / 10_000 / listing.areaPing).toFixed(2)} 萬/坪
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </section>

          {/* ============== 物件詳細資訊 ============== */}
          <Section title="物件詳細資訊" lead>
            <div
              className={
                isRent && rentConditionItems.length > 0
                  ? "grid gap-8 md:grid-cols-2 md:items-start"
                  : undefined
              }
            >
              <div>
                <h3 className="mb-3 text-base font-bold text-zinc-900 sm:text-lg">物件資訊</h3>
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
                        left={{ label: "型態", value: propertyTypeText }}
                        right={{ label: "法定用途", value: listing.legalUsage?.trim() || "—" }}
                      />
                      <InfoRowPair left={{ label: "朝向", value: orientationText }} />
                    </>
                  ) : (
                    <>
                      <InfoRowPair
                        left={{ label: "權狀坪數", value: `${listing.areaPing} 坪` }}
                        right={{ label: "主＋附屬", value: buildingAreaTotalText }}
                      />
                      <InfoRowPair
                        left={{ label: "型態", value: propertyTypeText }}
                        right={{ label: "樓層", value: floorText }}
                      />
                      <InfoRowPair
                        left={{ label: "朝向", value: orientationText }}
                        right={{ label: "管理費", value: managementFeeText }}
                      />
                      <InfoRowPair
                        left={{ label: "車位", value: hasParking ? parkingTypeText : "無" }}
                        right={
                          hasParking && parkingRentText ? { label: "車位租金", value: parkingRentText } : undefined
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              {isRent && rentConditionItems.length > 0 ? (
                <div className="border-t border-zinc-100 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0 lg:pl-8">
                  <h3 className="mb-3 text-base font-bold text-zinc-900 sm:text-lg">租賃條件</h3>
                  <div
                    className={
                      rentConditionItems.length >= 2
                        ? "grid grid-cols-2 gap-2 sm:gap-2.5"
                        : "grid grid-cols-1 gap-2"
                    }
                  >
                    {rentConditionItems.map((item) => (
                      <InfoBlock key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

          {/* ============== 提供設備/家具 ============== */}
          <Section title="提供設備/家具">
            <ListingAmenityGrid items={amenityGridItems} />
          </Section>

          {/* ============== 物件特色 ============== */}
          {features.length > 0 ? (
            <Section title="物件特色">
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {features.map((feature, i) => (
                  <li
                    key={`${feature}-${i}`}
                    className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-snug text-zinc-800">{feature}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* ============== 實景影片 ============== */}
          {listing.videoUrl ? (
            <Section title="實景影片">
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
            </Section>
          ) : null}

          {/* ============== 位置與周邊 ============== */}
          <Section title="位置與周邊">
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 sm:text-base">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-zinc-500">地　　址</dt>
                <dd className="min-w-0 break-words font-medium text-zinc-900">
                  {listing.city}
                  {listing.district}
                  {displayAddress}
                </dd>
              </div>
              {listing.community ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-zinc-500">所屬社區</dt>
                  <dd className="min-w-0 break-words font-medium text-zinc-900">{listing.community}</dd>
                </div>
              ) : null}
            </dl>

            {listing.mrtStation ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gradient-to-br from-sky-50 to-white px-4 py-3 ring-1 ring-sky-100">
                  <p className="flex items-center gap-2 text-sm font-bold text-sky-800">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] text-white">
                      交
                    </span>
                    交通
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-800">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold text-white ${mrtBadgeClass}`}
                    >
                      捷運
                    </span>
                    <span className="font-semibold">{listing.mrtStation}</span>
                    {mrtLine ? <span className="text-zinc-500">{mrtLine}</span> : null}
                  </p>
                </div>
              </div>
            ) : null}

            <iframe
              title="listing-map"
              src={mapUrl}
              className="mt-5 h-64 w-full rounded-xl border border-zinc-200 sm:h-72"
              loading="lazy"
            />
          </Section>
      </div>

      {/* 手機版底部固定諮詢列 */}
      {lineUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur lg:hidden print:hidden">
          <a href={lineUrl} target="_blank" rel="noopener noreferrer" className={lineButtonClass}>
            LINE 諮詢此物件
          </a>
        </div>
      ) : null}
    </main>
  );
}

function Section({ title, children, lead }: { title: string; children: ReactNode; lead?: boolean }) {
  return (
    <section
      className={
        lead
          ? "mt-14 border-t border-zinc-200 pt-12 sm:mt-16 sm:pt-14"
          : "mt-10 border-t border-zinc-200 pt-9 sm:mt-12 sm:pt-10"
      }
    >
      <h2
        className={
          lead
            ? "mb-6 text-xl font-bold text-zinc-900 sm:mb-8 sm:text-2xl"
            : "mb-6 text-lg font-bold text-zinc-900 sm:mb-8 sm:text-xl"
        }
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 格局專用列：標籤靠左、房廳衛陽台靠右 */
function InfoLayoutRow({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5 sm:py-3">
      <span className="shrink-0 text-xs font-medium text-zinc-500 sm:text-[13px]">格局</span>
      <p className="min-w-0 text-right text-base font-bold leading-relaxed text-zinc-900 sm:text-lg">{value}</p>
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
    <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 py-1.5 sm:gap-8 sm:py-2">
      <InfoRowCell label={left.label} value={left.value} />
      {right ? <InfoRowCell label={right.label} value={right.value} /> : null}
    </div>
  );
}

function InfoRowCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-2">
      <span className="shrink-0 text-xs font-medium text-zinc-500 sm:text-[13px]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-bold text-zinc-900 sm:text-[15px]">{value}</span>
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
