"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminListingRecord } from "@/lib/listings";
import { ToggleListingButton } from "@/components/toggle-listing-button";
import { DownloadExcelButton } from "@/components/download-excel-button";

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

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      <span className="text-zinc-500">{label}：</span>
      <span className="font-medium text-zinc-900">{value || "—"}</span>
    </p>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium text-zinc-900">{value}</p>
    </div>
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
          <article key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/listings/${r.id}`} className="text-base font-semibold text-zinc-900 hover:text-[#0b2545]">{r.title}</Link>
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>{r.isPublished ? "上架中" : "已下架"}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[220px_1fr_190px]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                {(() => {
                  const allImages = r.images.length > 0 ? r.images : r.coverImage ? [r.coverImage] : [];
                  const raw = allImages[0] ?? null;
                  const safe = raw
                    ? raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")
                      ? raw
                      : `https://${raw}`
                    : null;
                  const key = `${r.id}:${safe ?? ""}`;
                  if (!safe || brokenImageSet[key]) {
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <InfoItem label="地區" value={`${r.city}${r.district}`} />
                <InfoItem label="價格" value={formatPrice(r.price, r.listingType)} />
                <InfoItem label="格局" value={`${r.rooms}房 ${r.bathrooms}衛`} />
                <InfoItem label="坪數" value={`${r.areaPing}坪`} />
                <InfoItem label="社區" value={r.community ?? "—"} />
                <InfoItem label="帶看方式" value={r.viewingMethod ?? "—"} />
                <InfoItem label="可報稅" value={tri(r.taxDeductible)} />
                <InfoItem label="可租補" value={tri(r.rentSubsidy)} />
              </div>
              <div className="flex flex-col gap-2">
                <ToggleListingButton listingId={r.id} isPublished={r.isPublished} listingType={r.listingType} />
                <Link href={`/admin/listings/${r.id}/edit`} className="text-xs font-medium text-zinc-700 underline">修改內容</Link>
                <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">展開詳情</summary>
                  <div className="mt-2 space-y-1">
                    <DetailRow label="朝向" value={r.orientation} />
                    <DetailRow label="一層幾戶" value={r.householdsPerFloor} />
                    <DetailRow label="車位/租金" value={`${r.parkingType ?? "無"}${r.parkingRent ? ` / ${r.parkingRent}/月` : ""}`} />
                    <DetailRow label="房屋類型" value={r.legalUsage ?? r.usageZoning ?? "—"} />
                    <DetailRow label="能否短租" value={r.shortTermRent} />
                    <DetailRow label="服務費" value={r.serviceFee} />
                    <DetailRow label="使照登記" value={r.registrationUse} />
                    <DetailRow label="押金" value={r.securityDeposit} />
                    <DetailRow label="起租日" value={r.availableFrom} />
                    <DetailRow label="家具/家電" value={`${tri(r.furnitureProvided)} / ${tri(r.applianceProvided)}`} />
                    <DetailRow label="特色" value={r.features.filter(Boolean).join(" / ") || "—"} />
                  </div>
                </details>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">沒有符合條件的物件</p> : null}
      </div>
    </div>
  );
}

