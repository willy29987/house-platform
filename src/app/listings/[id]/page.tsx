import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import { ListingGallery } from "@/components/listing-gallery";
import { ListingShareActions } from "@/components/listing-share-actions";
import { getListingById, maskAddress } from "@/lib/listings";

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

const viewingMethodLabel: Record<string, string> = {
  KEY: "有鑰匙，隨時可帶看",
  OWNER_APPOINTMENT: "需約屋主時間",
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

function triLabel(v: boolean | null | undefined) {
  if (v === true) return "可";
  if (v === false) return "不可";
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
    listing.parkingIncluded === true;

  const layoutText = [
    `${listing.rooms}房`,
    listing.livingRooms != null ? `${listing.livingRooms}廳` : null,
    `${listing.bathrooms}衛`,
    listing.balconies != null ? `${listing.balconies}陽台` : null,
  ]
    .filter(Boolean)
    .join("");

  const conditionItems = [
    { label: "可養寵物", value: triLabel(listing.petsAllowed) },
    { label: "可報稅", value: triLabel(listing.taxDeductible) },
    { label: "可租屋補助", value: triLabel(listing.rentSubsidy) },
    { label: "可入戶籍", value: triLabel(listing.canRegisterAddress) },
  ].filter((item) => item.value !== null) as { label: string; value: string }[];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← 返回房源列表
        </Link>
        <FavoriteButton listingId={listing.id} />
      </div>

      <section className="mb-6">
        <ListingGallery title={listing.title} coverImage={listing.coverImage} images={listing.images ?? []} />
      </section>

      <section className="space-y-6">
        {/* ============== 標題區 ============== */}
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-4 py-1.5 text-base font-bold ${
                isRent ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {isRent ? "出租" : "買賣"}
            </span>
            <span className="text-xl font-bold text-zinc-800">
              {listing.city}
              {listing.district}
            </span>
            {listing.mrtStation ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-base font-bold text-white">
                🚇 {listing.mrtStation}
                {listing.mrtLine ? (
                  <span className="font-medium opacity-90">
                    · {listing.mrtLine.replace(/^.*? /, "")}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            {listing.title}
          </h1>

          {listing.community ? (
            <p className="mt-2 text-lg font-semibold text-zinc-600">
              🏢 {listing.community}
            </p>
          ) : null}

          {displayAddress ? (
            <p className="mt-2 text-lg text-zinc-600">📍 {displayAddress}</p>
          ) : null}

          {/* ============== 月租／售價 ＋ 管理費 ＋ 車位 ============== */}
          <div className="mt-6 grid gap-4 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] px-7 py-6 text-white shadow-md md:grid-cols-3 md:gap-0">
            {/* 月租／售價 */}
            <div className="border-b border-white/25 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-6">
              <p className="text-base font-semibold tracking-wide text-white/90">
                {isRent ? "月租" : "售價"}
              </p>
              {isRent ? (
                <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">
                  <span className="text-lg font-semibold text-white/90">NT$</span>{" "}
                  {listing.price.toLocaleString("zh-TW")}
                  <span className="ml-1 text-lg font-semibold text-white/90">/ 月</span>
                </p>
              ) : (
                (() => {
                  const { main, unit } = formatSalePrice(listing.price);
                  return (
                    <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">
                      {main}
                      <span className="ml-1 text-lg font-semibold text-white/90">{unit}元</span>
                    </p>
                  );
                })()
              )}
              {!isRent && listing.areaPing ? (
                <p className="mt-3 text-sm text-white/85">
                  單價約 {(listing.price / 10_000 / listing.areaPing).toFixed(2)} 萬 / 坪
                </p>
              ) : null}
            </div>

            {/* 管理費 */}
            <div className="border-b border-white/25 pb-4 md:border-b-0 md:border-r md:pb-0 md:px-6">
              <p className="text-base font-semibold tracking-wide text-white/90">管理費</p>
              {listing.managementFee ? (
                <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight">
                  <span className="text-lg font-semibold text-white/90">NT$</span>{" "}
                  {listing.managementFee.toLocaleString("zh-TW")}
                  <span className="ml-1 text-lg font-semibold text-white/90">/ 月</span>
                </p>
              ) : (
                <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-white">
                  免管理費
                </p>
              )}
            </div>

            {/* 車位 */}
            <div className="md:pl-6">
              <p className="text-base font-semibold tracking-wide text-white/90">車位</p>
              {hasParking ? (
                <>
                  <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight">
                    {listing.parkingType
                      ? parkingTypeLabel[listing.parkingType] ?? listing.parkingType
                      : "有車位"}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-white/85">
                    {listing.parkingSpaceInfo ? <p>位置：{listing.parkingSpaceInfo}</p> : null}
                    {isRent && listing.parkingRent ? (
                      <p>車位租金：NT$ {listing.parkingRent.toLocaleString("zh-TW")} / 月</p>
                    ) : null}
                    {!isRent && listing.parkingIncluded !== null ? (
                      <p>{listing.parkingIncluded ? "車位已含總價" : "車位另計"}</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-white">
                  無車位
                </p>
              )}
            </div>
          </div>

          {/* ============== 物件資訊：兩欄 label 左 / value 右 ============== */}
          <div className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
              物件資訊
            </h2>
            <div className="grid gap-x-10 sm:grid-cols-2">
              <InfoRow label="格局" value={layoutText} />
              <InfoRow label="權狀坪數" value={`${listing.areaPing} 坪`} />
              <InfoRow label="物件類型" value={propertyTypeLabel[listing.propertyType] ?? listing.propertyType} />
              <InfoRow
                label="樓層"
                value={
                  listing.floor && listing.totalFloors
                    ? `${listing.floor} / ${listing.totalFloors} F`
                    : "—"
                }
              />
              {listing.areaMain ? <InfoRow label="主建物" value={`${listing.areaMain} 坪`} /> : null}
              {listing.areaAncillary ? (
                <InfoRow label="附屬建物" value={`${listing.areaAncillary} 坪`} />
              ) : null}
              {listing.areaParkingSpace ? (
                <InfoRow label="車位坪數" value={`${listing.areaParkingSpace} 坪`} />
              ) : null}
              {listing.buildingAge ? (
                <InfoRow label="屋齡" value={`${listing.buildingAge} 年`} />
              ) : null}
              {listing.orientation ? <InfoRow label="朝向" value={listing.orientation} /> : null}
              {listing.decorLevel ? <InfoRow label="裝潢" value={listing.decorLevel} /> : null}
              {listing.usageZoning ? <InfoRow label="使用分區" value={listing.usageZoning} /> : null}
              {listing.legalUsage ? <InfoRow label="法定用途" value={listing.legalUsage} /> : null}
              {listing.hasElevator !== null ? (
                <InfoRow label="電梯" value={listing.hasElevator ? "有" : "無"} />
              ) : null}
            </div>
          </div>
        </div>

        {/* ============== 租賃條件 ============== */}
        {isRent && (listing.viewingMethod || conditionItems.length > 0) ? (
          <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
              租賃條件
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {listing.viewingMethod ? (
                <InfoBlock
                  label="帶看方式"
                  value={viewingMethodLabel[listing.viewingMethod] ?? listing.viewingMethod}
                />
              ) : null}
              {conditionItems.map((item) => (
                <InfoBlock key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        ) : null}

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
          <div className="rounded-2xl bg-gradient-to-br from-zinc-50 to-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
              物件特色
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <div
                  key={`${feature}-${i}`}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-[#0b2545] hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-base leading-relaxed text-zinc-800">{feature}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ============== 地圖 ============== */}
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-9">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-zinc-900">
            <span className="inline-block h-6 w-1.5 rounded-full bg-[#0b2545]" />
            地圖位置（概略）
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            ※ 為保護屋主隱私，實際門牌號碼將於帶看時提供。
          </p>
          <iframe
            title="listing-map"
            src={mapUrl}
            className="h-80 w-full rounded-xl border border-zinc-200"
            loading="lazy"
          />
        </div>

        <ListingShareActions title={listing.title} />
      </section>
    </main>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-4">
      <span className="text-base font-medium text-zinc-500">{label}</span>
      <span className="text-xl font-bold text-zinc-900">{value}</span>
    </div>
  );
}
