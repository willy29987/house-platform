"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ToggleListingButton } from "@/components/toggle-listing-button";

type AdminListing = {
  id: string;
  title: string;
  listingType: "RENT" | "SALE";
  city: string;
  district: string;
  address?: string;
  community?: string | null;
  price: number;
  areaPing: number;
  rooms: number;
  bathrooms: number;
  floor?: number | null;
  totalFloors?: number | null;
  hasElevator?: boolean | null;
  parkingType?: string | null;
  parkingRent?: number | null;
  petsAllowed?: boolean | null;
  taxDeductible?: boolean | null;
  rentSubsidy?: boolean | null;
  viewingMethod?: string | null;
  orientation?: string | null;
  legalUsage?: string | null;
  usageZoning?: string | null;
  coverImage?: string | null;
  images?: string[];
  features?: string[];
  createdByUsername?: string | null;
  furnitureProvided?: boolean | null;
  applianceProvided?: boolean | null;
  shortTermRent?: string | null;
  serviceFee?: string | null;
  registrationUse?: string | null;
  securityDeposit?: string | null;
  availableFrom?: string | null;
  householdsPerFloor?: string | null;
  isPublished: boolean;
  createdAt: Date;
};

type AdminListingTableProps = {
  listings: AdminListing[];
  listingType: "RENT" | "SALE";
  currentUsername: string;
  isSuperAdmin: boolean;
};

type TriFilter = "ALL" | "YES" | "NO";

function formatAdminPrice(price: number, type: "RENT" | "SALE") {
  if (type === "RENT") return `NT$ ${price.toLocaleString("zh-TW")} / 月`;
  if (price >= 100000000) return `${(price / 100000000).toFixed(1)} 億`;
  return `${(price / 10000).toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;
}

export function AdminListingTable({ listings, listingType, currentUsername, isSuperAdmin }: AdminListingTableProps) {
  const [ownerFilter, setOwnerFilter] = useState<"ALL" | "MINE">("ALL");
  const [mineStatusFilter, setMineStatusFilter] = useState<"ALL" | "UNPUBLISHED">("ALL");
  const [imageIndexById, setImageIndexById] = useState<Record<string, number>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [brokenImageSet, setBrokenImageSet] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("ALL");
  const [district, setDistrict] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRooms, setMinRooms] = useState("");
  const [maxRooms, setMaxRooms] = useState("");
  const [minPing, setMinPing] = useState("");
  const [maxPing, setMaxPing] = useState("");
  const [layoutFilter, setLayoutFilter] = useState<"ALL" | "WHOLE" | "STUDIO">("ALL");
  const [taxFilter, setTaxFilter] = useState<TriFilter>("ALL");
  const [subsidyFilter, setSubsidyFilter] = useState<TriFilter>("ALL");
  const [petsFilter, setPetsFilter] = useState<TriFilter>("ALL");
  const [elevatorFilter, setElevatorFilter] = useState<TriFilter>("ALL");
  const [parkingFilter, setParkingFilter] = useState<TriFilter>("ALL");
  const [furnitureFilter, setFurnitureFilter] = useState<TriFilter>("ALL");
  const [applianceFilter, setApplianceFilter] = useState<TriFilter>("ALL");

  const cityOptions = useMemo(() => Array.from(new Set(listings.map((l) => l.city))).sort(), [listings]);
  const districtOptions = useMemo(
    () => Array.from(new Set(listings.filter((l) => city === "ALL" || l.city === city).map((l) => l.district))).sort(),
    [listings, city],
  );

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;
    const minR = minRooms ? Number(minRooms) : null;
    const maxR = maxRooms ? Number(maxRooms) : null;
    const minA = minPing ? Number(minPing) : null;
    const maxA = maxPing ? Number(maxPing) : null;
    const passTri = (value: boolean | null | undefined, filter: TriFilter) =>
      filter === "ALL" ? true : filter === "YES" ? value === true : value === false;

    return listings
      .filter((l) => l.listingType === listingType)
      .filter((l) => (ownerFilter === "MINE" && mineStatusFilter === "UNPUBLISHED" ? !l.isPublished : l.isPublished))
      .filter((l) => (ownerFilter === "ALL" ? true : l.createdByUsername === currentUsername))
      .filter((l) => (city === "ALL" ? true : l.city === city))
      .filter((l) => (district === "ALL" ? true : l.district === district))
      .filter((l) => (minP == null ? true : l.price >= minP))
      .filter((l) => (maxP == null ? true : l.price <= maxP))
      .filter((l) => (minR == null ? true : l.rooms >= minR))
      .filter((l) => (maxR == null ? true : l.rooms <= maxR))
      .filter((l) => (minA == null ? true : l.areaPing >= minA))
      .filter((l) => (maxA == null ? true : l.areaPing <= maxA))
      .filter((l) => (layoutFilter === "ALL" ? true : layoutFilter === "STUDIO" ? l.title.includes("套房") : !l.title.includes("套房")))
      .filter((l) => (listingType === "RENT" ? passTri(l.taxDeductible, taxFilter) : true))
      .filter((l) => (listingType === "RENT" ? passTri(l.rentSubsidy, subsidyFilter) : true))
      .filter((l) => (listingType === "RENT" ? passTri(l.petsAllowed, petsFilter) : true))
      .filter((l) => passTri(l.hasElevator, elevatorFilter))
      .filter((l) => passTri(l.furnitureProvided, furnitureFilter))
      .filter((l) => passTri(l.applianceProvided, applianceFilter))
      .filter((l) => (parkingFilter === "ALL" ? true : parkingFilter === "YES" ? Boolean(l.parkingType) : !l.parkingType))
      .filter((l) => {
        if (!text) return true;
        const hay = `${l.title}${l.city}${l.district}${l.address ?? ""}${l.community ?? ""}`.toLowerCase();
        return hay.includes(text);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [listings, listingType, ownerFilter, mineStatusFilter, currentUsername, city, district, minPrice, maxPrice, minRooms, maxRooms, minPing, maxPing, layoutFilter, taxFilter, subsidyFilter, petsFilter, elevatorFilter, furnitureFilter, applianceFilter, parkingFilter, keyword]);

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-3 text-sm font-semibold text-zinc-900">快速篩選條件</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={city} onChange={(e) => { setCity(e.target.value); setDistrict("ALL"); }} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">全部縣市</option>{cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">全部行政區</option>{districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder={listingType === "RENT" ? "最低租金" : "最低售價"} className="w-28 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder={listingType === "RENT" ? "最高租金" : "最高售價"} className="w-28 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input type="number" value={minRooms} onChange={(e) => setMinRooms(e.target.value)} placeholder="最少幾房" className="w-24 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input type="number" value={maxRooms} onChange={(e) => setMaxRooms(e.target.value)} placeholder="最多幾房" className="w-24 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input type="number" value={minPing} onChange={(e) => setMinPing(e.target.value)} placeholder="最小坪數" className="w-24 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <input type="number" value={maxPing} onChange={(e) => setMaxPing(e.target.value)} placeholder="最大坪數" className="w-24 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
          <select value={layoutFilter} onChange={(e) => setLayoutFilter(e.target.value as "ALL" | "WHOLE" | "STUDIO")} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">房型不限</option><option value="WHOLE">整層住家</option><option value="STUDIO">獨立套房</option></select>
          {listingType === "RENT" ? (<><select value={taxFilter} onChange={(e) => setTaxFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">報稅不限</option><option value="YES">可報稅</option><option value="NO">不可報稅</option></select><select value={subsidyFilter} onChange={(e) => setSubsidyFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">租補不限</option><option value="YES">可租補</option><option value="NO">不可租補</option></select><select value={petsFilter} onChange={(e) => setPetsFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">寵物不限</option><option value="YES">可養寵物</option><option value="NO">不可養寵物</option></select></>) : null}
          <select value={elevatorFilter} onChange={(e) => setElevatorFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">電梯不限</option><option value="YES">有電梯</option><option value="NO">無電梯</option></select>
          <select value={parkingFilter} onChange={(e) => setParkingFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">車位不限</option><option value="YES">有車位</option><option value="NO">無車位</option></select>
          <select value={furnitureFilter} onChange={(e) => setFurnitureFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">家具不限</option><option value="YES">有家具</option><option value="NO">無家具</option></select>
          <select value={applianceFilter} onChange={(e) => setApplianceFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">家電不限</option><option value="YES">有家電</option><option value="NO">無家電</option></select>
          <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋 標題 / 社區 / 地址" className="ml-auto w-64 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs" />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-full border border-zinc-200">
          <button
            type="button"
            onClick={() => setOwnerFilter("ALL")}
            className={`px-3 py-1 text-xs ${ownerFilter === "ALL" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => { setOwnerFilter("MINE"); setMineStatusFilter("ALL"); }}
            className={`border-l border-zinc-200 px-3 py-1 text-xs ${ownerFilter === "MINE" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
          >
            我刊登
          </button>
        </div>
        {ownerFilter === "MINE" ? (
          <div className="inline-flex overflow-hidden rounded-full border border-zinc-200">
            <button
              type="button"
              onClick={() => setMineStatusFilter("ALL")}
              className={`px-3 py-1 text-xs ${mineStatusFilter === "ALL" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
            >
              上架
            </button>
            <button
              type="button"
              onClick={() => setMineStatusFilter("UNPUBLISHED")}
              className={`border-l border-zinc-200 px-3 py-1 text-xs ${mineStatusFilter === "UNPUBLISHED" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
            >
              下架
            </button>
          </div>
        ) : null}
        <span className="ml-auto text-xs text-zinc-500">全部物件中符合條件：共 {filtered.length} 筆</span>
      </div>

      {filtered.length === 0 ? <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">此分類目前沒有房源。</p> : (
        <div className="space-y-3">
          {filtered.map((l) => {
            const canEdit = isSuperAdmin || l.createdByUsername === currentUsername;
            const imgs = l.images && l.images.length > 0 ? l.images : l.coverImage ? [l.coverImage] : [];
            const currentIndex = imageIndexById[l.id] ?? 0;
            const currentImage = imgs.length ? imgs[Math.min(currentIndex, imgs.length - 1)] : null;
            const shiftImage = (delta: number) => {
              if (imgs.length <= 1) return;
              setImageIndexById((prev) => ({
                ...prev,
                [l.id]: ((prev[l.id] ?? 0) + delta + imgs.length) % imgs.length,
              }));
            };
            const safeImage = (src: string | null) => {
              if (!src) return null;
              if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return src;
              return `https://${src}`;
            };
            const currentImageUrl = safeImage(currentImage);
            const imageKey = `${l.id}:${currentImageUrl ?? ""}`;
            const canShowImage = Boolean(currentImageUrl && !brokenImageSet[imageKey]);
            return (
              <article key={l.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/listings/${l.id}`} className="line-clamp-1 text-base font-semibold text-zinc-900 hover:text-[#0b2545]">{l.title}</Link>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{new Intl.DateTimeFormat("zh-TW").format(l.createdAt)}</span>
                    <span>{l.createdByUsername ?? "—"}</span>
                    {canEdit ? <Link href={`/admin/listings/${l.id}/edit`} className="font-medium text-zinc-700 underline">修改內容</Link> : null}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[220px_1fr_190px]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                    {canShowImage ? (
                      <>
                        <img
                          src={currentImageUrl!}
                          alt={l.title}
                          className="h-full w-full cursor-zoom-in object-cover"
                          loading="lazy"
                          onClick={() => setLightboxSrc(currentImageUrl!)}
                          onError={() => setBrokenImageSet((prev) => ({ ...prev, [imageKey]: true }))}
                        />
                        {imgs.length > 1 ? (
                          <>
                            <button type="button" onClick={() => shiftImage(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">‹</button>
                            <button type="button" onClick={() => shiftImage(1)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">›</button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-500">無圖片</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <InfoItem label="地區" value={`${l.city}${l.district}`} />
                    <InfoItem label="價格" value={formatAdminPrice(l.price, l.listingType)} />
                    <InfoItem label="格局" value={`${l.rooms}房 ${l.bathrooms}衛`} />
                    <InfoItem label="坪數" value={`${l.areaPing}坪`} />
                    <InfoItem label="社區" value={l.community ?? "—"} />
                    <InfoItem label="帶看方式" value={l.viewingMethod ?? "—"} />
                    <InfoItem label="刊登業務" value={l.createdByUsername ?? "—"} />
                    <InfoItem label="寵物" value={triText(l.petsAllowed)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {canEdit ? <ToggleListingButton listingId={l.id} isPublished={l.isPublished} listingType={l.listingType} /> : null}
                    <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs">
                      <summary className="cursor-pointer font-medium">展開詳情</summary>
                      <div className="mt-2 space-y-1">
                        <DetailRow label="朝向" value={l.orientation} />
                        <DetailRow label="一層幾戶" value={l.householdsPerFloor} />
                        <DetailRow label="車位/租金" value={`${l.parkingType ?? "無"}${l.parkingRent ? ` / ${l.parkingRent}/月` : ""}`} />
                        <DetailRow label="房屋類型" value={l.legalUsage ?? l.usageZoning ?? "—"} />
                        <DetailRow label="能否短租" value={l.shortTermRent} />
                        <DetailRow label="服務費" value={l.serviceFee} />
                        <DetailRow label="使照登記" value={l.registrationUse} />
                        <DetailRow label="押金" value={l.securityDeposit} />
                        <DetailRow label="起租日" value={l.availableFrom} />
                        <DetailRow label="家具/家電" value={`${triText(l.furnitureProvided)} / ${triText(l.applianceProvided)}`} />
                        <DetailRow label="特色" value={l.features?.filter(Boolean).join(" / ") || "—"} />
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {lightboxSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="preview" className="max-h-[90vh] max-w-[95vw] object-contain" />
        </div>
      ) : null}
    </div>
  );
}

function triText(v: boolean | null | undefined) { return v === true ? "有" : v === false ? "無" : "—"; }
function InfoItem({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-zinc-500">{label}</p><p className="font-medium text-zinc-900">{value}</p></div>; }
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) { return <p><span className="text-zinc-500">{label}：</span><span className="font-medium text-zinc-900">{value || "—"}</span></p>; }
