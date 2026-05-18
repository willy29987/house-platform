"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminListingRecord } from "@/lib/listings";
import { ToggleListingButton } from "@/components/toggle-listing-button";
import { DownloadExcelButton } from "@/components/download-excel-button";
import { formatParkingTypeLabel } from "@/lib/parking-type-label";
import { formatFurnitureApplianceZh } from "@/lib/furniture-appliance-value";

type Props = { records: AdminListingRecord[] };

function formatPrice(price: number, type: "RENT" | "SALE") {
  if (type === "RENT") return `NT$ ${price.toLocaleString("zh-TW")} / 月`;
  if (price >= 100_000_000) return `${(price / 100_000_000).toFixed(1)} 億`;
  return `${(price / 10_000).toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;
}

function tri(v: boolean | null | undefined) {
  if (v === true) return "有";
  if (v === false) return "無";
  return "—";
}

function formatPing(v: number | null | undefined) {
  return v == null ? "—" : `${v.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}坪`;
}

function formatLayout(r: Pick<AdminListingRecord, "rooms" | "livingRooms" | "bathrooms" | "balconies">) {
  return `${r.rooms}房 ${r.livingRooms ?? 0}廳 ${r.bathrooms}衛 ${r.balconies ?? 0}陽台`;
}

function formatFloor(floor: number | null | undefined, totalFloors: number | null | undefined) {
  if (floor == null && totalFloors == null) return "—";
  if (floor == null) return `共 ${totalFloors} 樓`;
  if (totalFloors == null) return `${floor} 樓`;
  return `${floor} 樓 / 共 ${totalFloors} 樓`;
}

function stripKnownRegion(address: string | null | undefined, city: string, district: string) {
  let value = (address ?? "").trim();
  for (const prefix of [`${city}${district}`, city, district]) {
    if (prefix && value.startsWith(prefix)) value = value.slice(prefix.length).trim();
  }
  return value;
}

function formatVisibleAddressDetail(r: Pick<AdminListingRecord, "city" | "district" | "address">) {
  return stripKnownRegion(r.address, r.city, r.district);
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      <span className="text-zinc-500">{label}：</span>
      <span className="font-medium text-zinc-900">{value || "—"}</span>
    </p>
  );
}

export function AdminListingRecords({ records }: Props) {
  const [type, setType] = useState<"RENT" | "SALE">("RENT");
  const [status, setStatus] = useState<"ALL" | "PUBLISHED" | "UNPUBLISHED">("ALL");
  const [keyword, setKeyword] = useState("");
  const [brokenImageSet, setBrokenImageSet] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return records
      .filter((r) => r.listingType === type)
      .filter((r) => (status === "ALL" ? true : status === "PUBLISHED" ? r.isPublished : !r.isPublished))
      .filter((r) => {
        if (!k) return true;
        return `${r.title}${r.city}${r.district}${r.address}${r.community ?? ""}`.toLowerCase().includes(k);
      });
  }, [records, type, status, keyword]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setType("RENT")} className={`rounded-full px-3 py-1 text-xs ${type === "RENT" ? "bg-[#0b2545] text-white" : "bg-zinc-100 text-zinc-700"}`}>租賃</button>
        <button type="button" onClick={() => setType("SALE")} className={`rounded-full px-3 py-1 text-xs ${type === "SALE" ? "bg-[#0b2545] text-white" : "bg-zinc-100 text-zinc-700"}`}>買賣</button>
        <button type="button" onClick={() => setStatus("ALL")} className={`rounded-full px-3 py-1 text-xs ${status === "ALL" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>全部</button>
        <button type="button" onClick={() => setStatus("PUBLISHED")} className={`rounded-full px-3 py-1 text-xs ${status === "PUBLISHED" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>上架中</button>
        <button type="button" onClick={() => setStatus("UNPUBLISHED")} className={`rounded-full px-3 py-1 text-xs ${status === "UNPUBLISHED" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>已下架</button>
        <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋標題/地址/社區" className="ml-auto w-64 rounded-full border border-zinc-200 px-3 py-1.5 text-xs" />
        <DownloadExcelButton />
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <article key={r.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="grid grid-cols-[168px_1fr] gap-0 sm:grid-cols-[210px_1fr] lg:grid-cols-[225px_1fr]">
              <div className="relative h-[132px] overflow-hidden bg-zinc-100 sm:h-[146px] lg:h-[150px]">
                {(() => {
                  const allImages = r.images.length > 0 ? r.images : r.coverImage ? [r.coverImage] : [];
                  const raw = allImages[0] ?? null;
                  const safe = raw
                    ? raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")
                      ? raw
                      : `https://${raw}`
                    : null;
                  const video = r.videoUrl
                    ? r.videoUrl.startsWith("http://") || r.videoUrl.startsWith("https://") || r.videoUrl.startsWith("/")
                      ? r.videoUrl
                      : `https://${r.videoUrl}`
                    : null;
                  const key = `${r.id}:${safe ?? ""}`;
                  if (!safe || brokenImageSet[key]) {
                    if (video) {
                      return (
                        <video
                          src={video}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          controls
                        />
                      );
                    }
                    return <div className="flex h-full items-center justify-center text-xs text-zinc-500">無圖片</div>;
                  }
                  return (
                    <img
                      src={safe}
                      alt={r.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setBrokenImageSet((prev) => ({ ...prev, [key]: true }))}
                    />
                  );
                })()}
              </div>

              <div className="flex h-[132px] flex-col justify-between overflow-hidden p-2.5 sm:h-[146px] sm:p-3 lg:h-[150px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/listings/${r.id}`} className="line-clamp-1 text-sm font-bold leading-snug text-zinc-950 hover:text-[#0b2545] sm:text-base">
                      {r.title}
                    </Link>
                    <p className="mt-1 truncate text-xs font-medium text-zinc-600">
                      {r.city}{r.district}{formatVisibleAddressDetail(r) || ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <span className="max-w-[7rem] truncate text-xs text-zinc-600" title={r.createdByUsername ?? undefined}>
                      業務 {r.createdByUsername ?? "—"}
                    </span>
                    <span className="whitespace-nowrap text-xs text-zinc-600">
                      上架 {new Intl.DateTimeFormat("zh-TW").format(r.createdAt)}
                    </span>
                    <ToggleListingButton listingId={r.id} isPublished={r.isPublished} listingType={r.listingType} />
                    <Link href={`/admin/listings/${r.id}/edit`} className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                      修改內容
                    </Link>
                  </div>
                </div>

                <div className="mt-2 grid gap-x-5 gap-y-1 md:grid-cols-[minmax(140px,1fr)_minmax(180px,1.35fr)_minmax(110px,0.8fr)_minmax(120px,0.9fr)]">
                  <InfoStat label="價格" value={formatPrice(r.price, r.listingType)} />
                  <InfoStat label="格局" value={formatLayout(r)} />
                  <InfoStat label="權狀坪數" value={formatPing(r.areaPing)} />
                  <InfoStat label="樓層" value={formatFloor(r.floor, r.totalFloors)} />
                </div>

              </div>
            </div>

            <details className="border-t border-zinc-100 bg-zinc-50 px-4 py-1 text-xs">
              <summary className="flex cursor-pointer list-none justify-center text-base font-bold leading-none text-zinc-600 [&::-webkit-details-marker]:hidden">⌄</summary>
              <div className="mt-1 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                <DetailRow label="朝向" value={r.orientation} />
                <DetailRow label="一層幾戶" value={r.householdsPerFloor} />
                <DetailRow label="主建物" value={formatPing(r.areaMain)} />
                <DetailRow label="附屬建物" value={formatPing(r.areaAncillary)} />
                <DetailRow label="車位坪數" value={formatPing(r.areaParkingSpace)} />
                <DetailRow label="車位樓層/號碼" value={r.parkingSpaceInfo} />
                <DetailRow
                  label="車位/租金"
                  value={`${formatParkingTypeLabel(r.parkingType)}${r.parkingRent ? ` / ${r.parkingRent}/月` : ""}`}
                />
                <DetailRow label="電梯" value={tri(r.hasElevator)} />
                <DetailRow label="屋齡" value={r.buildingAge != null ? `${r.buildingAge}年` : "—"} />
                <DetailRow label="管理費" value={r.managementFee ? `NT$ ${r.managementFee.toLocaleString("zh-TW")}` : "—"} />
                <DetailRow label="房屋類型" value={r.legalUsage ?? r.usageZoning ?? "—"} />
                <DetailRow label="使照登記" value={r.registrationUse} />
                {r.listingType === "RENT" ? (
                  <>
                    <DetailRow label="寵物" value={tri(r.petsAllowed)} />
                    <DetailRow label="報稅" value={tri(r.taxDeductible)} />
                    <DetailRow label="租補" value={tri(r.rentSubsidy)} />
                    <DetailRow label="起租日" value={r.availableFrom} />
                    <DetailRow label="能否短租" value={r.shortTermRent} />
                    <DetailRow label="服務費" value={r.serviceFee} />
                    <DetailRow label="押金" value={r.securityDeposit} />
                    <DetailRow label="家具/家電" value={`${formatFurnitureApplianceZh(r.furnitureProvided)} / ${formatFurnitureApplianceZh(r.applianceProvided)}`} />
                  </>
                ) : null}
                <DetailRow label="特色" value={r.features.filter(Boolean).join(" / ") || "—"} />
              </div>
            </details>
          </article>
        ))}
        {filtered.length === 0 ? <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">沒有符合條件的物件</p> : null}
      </div>
    </div>
  );
}

