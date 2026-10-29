"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminListingRecord } from "@/lib/listings";
import { ToggleListingButton } from "@/components/toggle-listing-button";
import { DownloadExcelButton } from "@/components/download-excel-button";
import { formatParkingTypeLabel } from "@/lib/parking-type-label";
import { formatFurnitureAndEquipmentZh } from "@/lib/furniture-appliance-value";
import {
  formatRocDate,
  getDaysUntilRelease,
  isUpcomingRelease as computeIsUpcomingRelease,
  unpublishCategoryLabel,
} from "@/lib/listing-internal-meta";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";

type Props = { records: AdminListingRecord[]; staffLabels?: Record<string, string> };

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

export function AdminListingRecords({ records, staffLabels = {} }: Props) {
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
      })
      .sort((a, b) => {
        // 1) 即將釋出（未上架且距釋出日 ≤ 60 天）置頂
        const aUp = computeIsUpcomingRelease({
          isPublished: a.isPublished,
          expectedReleaseDate: a.expectedReleaseDate,
        });
        const bUp = computeIsUpcomingRelease({
          isPublished: b.isPublished,
          expectedReleaseDate: b.expectedReleaseDate,
        });
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        // 同為即將釋出 → 距離釋出近的優先
        if (aUp && bUp) {
          const aDays = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
          const bDays = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
          if (aDays !== bDays) return aDays - bDays;
        }
        // 2) 都未上架 → 下架時間新的優先（reverse chronological）
        if (!a.isPublished && !b.isPublished) {
          const aT = a.unpublishedAt ? new Date(a.unpublishedAt).getTime() : 0;
          const bT = b.unpublishedAt ? new Date(b.unpublishedAt).getTime() : 0;
          if (aT !== bT) return bT - aT;
        }
        // 3) 預設：建立時間新的優先
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [records, type, status, keyword]);

  const upcomingList = useMemo(
    () =>
      records
        .filter((r) => r.listingType === type)
        .filter((r) =>
          computeIsUpcomingRelease({
            isPublished: r.isPublished,
            expectedReleaseDate: r.expectedReleaseDate,
          }),
        )
        .sort((a, b) => {
          const aDays = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
          const bDays = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
          return aDays - bDays;
        }),
    [records, type],
  );

  return (
    <div>
      {upcomingList.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <span aria-hidden>🔔</span>
              即將釋出提醒
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                {upcomingList.length} 筆
              </span>
            </p>
            <p className="text-[11px] text-amber-700">
              下架後預計釋出日 ≤ 2 個月（60 天）的物件，已自動置頂於下方列表。
            </p>
          </div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingList.slice(0, 6).map((r) => {
              const days = getDaysUntilRelease(r.expectedReleaseDate);
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs ring-1 ring-amber-200">
                  <Link href={`/listings/${r.id}`} className="line-clamp-1 min-w-0 flex-1 font-semibold text-amber-900 hover:underline">
                    {r.title}
                  </Link>
                  <span className="shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    {days === 0 ? "今日" : days != null ? `剩 ${days} 天` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {upcomingList.length > 6 ? (
            <p className="mt-1.5 text-[11px] text-amber-700">…另有 {upcomingList.length - 6} 筆，請於下方查看。</p>
          ) : null}
        </div>
      ) : null}

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
        {filtered.map((r) => {
          const upcoming = computeIsUpcomingRelease({
            isPublished: r.isPublished,
            expectedReleaseDate: r.expectedReleaseDate,
          });
          const daysUntilRelease = getDaysUntilRelease(r.expectedReleaseDate);
          const articleClass = upcoming
            ? "overflow-hidden rounded-2xl border-2 border-amber-400 bg-amber-50/40 shadow-sm ring-1 ring-amber-200"
            : !r.isPublished
              ? "overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60 shadow-sm"
              : "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm";
          return (
          <article key={r.id} className={articleClass}>
            {upcoming ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-100/80 px-3 py-1.5 text-xs font-semibold text-amber-900">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>⏰</span>
                  即將釋出
                  {daysUntilRelease != null ? (
                    <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      {daysUntilRelease === 0 ? "今日釋出" : `剩 ${daysUntilRelease} 天`}
                    </span>
                  ) : null}
                  {r.unpublishCategory ? (
                    <span className="text-[11px] font-medium text-amber-700">
                      · {unpublishCategoryLabel(r.unpublishCategory)}
                    </span>
                  ) : null}
                </span>
                <span className="text-amber-800/90">
                  下架 {r.unpublishedAt ? formatRocDate(r.unpublishedAt) : "—"}
                  　·　預計釋出 {formatRocDate(r.expectedReleaseDate)}
                </span>
              </div>
            ) : !r.isPublished ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100/80 px-3 py-1.5 text-xs font-semibold text-zinc-700">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>📦</span>
                  已下架
                  {r.unpublishCategory ? (
                    <span className="text-[11px] font-medium text-zinc-500">
                      · {unpublishCategoryLabel(r.unpublishCategory)}
                    </span>
                  ) : null}
                </span>
                <span className="text-zinc-600">
                  下架 {r.unpublishedAt ? formatRocDate(r.unpublishedAt) : "—"}
                  {r.expectedReleaseDate ? `　·　預計釋出 ${formatRocDate(r.expectedReleaseDate)}` : ""}
                  {daysUntilRelease != null && daysUntilRelease > 60 ? `（${daysUntilRelease} 天後）` : ""}
                </span>
              </div>
            ) : null}
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
                      {r.propertyType === "SUITE" && r.roomNumber ? (
                        <span className="mr-1.5 rounded bg-[#0b2545]/10 px-1.5 py-0.5 align-middle text-[11px] font-bold text-[#0b2545]">
                          房號 {r.roomNumber}
                        </span>
                      ) : null}
                      {r.title}
                    </Link>
                    <p className="mt-1 truncate text-xs font-medium text-zinc-600">
                      {r.city}{r.district}{formatVisibleAddressDetail(r) || ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <span className="max-w-[7rem] truncate text-xs text-zinc-600" title={r.createdByUsername ?? undefined}>
                      業務 {formatAdminStaffLabel(r.createdByUsername, staffLabels)}
                    </span>
                    <span className="whitespace-nowrap text-xs text-zinc-600">
                      上架 {new Intl.DateTimeFormat("zh-TW").format(r.createdAt)}
                    </span>
                    <ToggleListingButton listingId={r.id} isPublished={r.isPublished} listingType={r.listingType} />
                    <Link
                      href={`/listings/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[#0b2545]/20 bg-[#0b2545]/5 px-2.5 py-1 text-xs font-semibold text-[#0b2545] hover:bg-[#0b2545]/10"
                    >
                      查看廣告 ↗
                    </Link>
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
                {r.propertyType === "SUITE" ? <DetailRow label="房間號碼" value={r.roomNumber} /> : null}
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
                    <DetailRow label="家具/設備" value={formatFurnitureAndEquipmentZh({ furnitureItems: r.furnitureItems, furnitureLegacy: r.furnitureProvided, equipmentItems: r.equipmentItems, equipmentLegacy: r.applianceProvided })} />
                  </>
                ) : null}
                <DetailRow label="特色" value={r.features.filter(Boolean).join(" / ") || "—"} />
                {!r.isPublished ? (
                  <>
                    <DetailRow label="下架類型" value={unpublishCategoryLabel(r.unpublishCategory)} />
                    <DetailRow
                      label="下架時間"
                      value={r.unpublishedAt ? formatRocDate(r.unpublishedAt) : "—"}
                    />
                    <DetailRow
                      label="預計釋出"
                      value={r.expectedReleaseDate ? formatRocDate(r.expectedReleaseDate) : "—"}
                    />
                    {daysUntilRelease != null && daysUntilRelease >= 0 ? (
                      <DetailRow
                        label="距釋出"
                        value={daysUntilRelease === 0 ? "今日" : `${daysUntilRelease} 天`}
                      />
                    ) : null}
                    <DetailRow label="下架備註" value={r.unpublishNote} />
                  </>
                ) : null}
              </div>
            </details>
          </article>
          );
        })}
        {filtered.length === 0 ? <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">沒有符合條件的物件</p> : null}
      </div>
    </div>
  );
}

