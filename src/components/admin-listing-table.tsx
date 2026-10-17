"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ListingDealCloseButton } from "@/components/listing-deal-close-button";
import { ToggleListingButton } from "@/components/toggle-listing-button";
import { formatParkingTypeLabel } from "@/lib/parking-type-label";
import type { FurnitureApplianceValue } from "@/lib/furniture-appliance-value";
import { formatFurnitureAndEquipmentZh } from "@/lib/furniture-appliance-value";
import {
  canViewRerentListing,
  filterUpcomingRentListings,
  formatRocDate,
  getDaysUntilRelease,
  isUpcomingRelease as computeIsUpcomingRelease,
  sortUpcomingRentListingsNewestFirst,
  unpublishCategoryLabel,
} from "@/lib/listing-internal-meta";

const desktopCardActionBtn =
  "whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60";
const desktopUnpublishBtn =
  "whitespace-nowrap rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 disabled:opacity-60";
const desktopPublishBtn =
  "whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60";
const desktopDealBtn =
  "whitespace-nowrap rounded-lg border border-[#0b2545] bg-white px-3 py-1.5 text-sm font-semibold text-[#0b2545] hover:bg-[#0b2545]/5 disabled:opacity-60";

const mobileCardActionBtn =
  "whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60";
const mobileUnpublishBtn =
  "whitespace-nowrap rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 disabled:opacity-60";
const mobilePublishBtn =
  "whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60";
const mobileDealBtn =
  "whitespace-nowrap rounded-lg border border-[#0b2545] bg-white px-2.5 py-1 text-xs font-semibold text-[#0b2545] hover:bg-[#0b2545]/5 disabled:opacity-60";

type AdminListing = {
  id: string;
  title: string;
  listingType: "RENT" | "SALE";
  propertyType?: string;
  roomNumber?: string | null;
  city: string;
  district: string;
  address?: string;
  community?: string | null;
  price: number;
  areaPing: number;
  areaMain?: number | null;
  areaAncillary?: number | null;
  areaParkingSpace?: number | null;
  parkingSpaceInfo?: string | null;
  rooms: number;
  livingRooms?: number | null;
  balconies?: number | null;
  bathrooms: number;
  floor?: number | null;
  totalFloors?: number | null;
  buildingAge?: number | null;
  managementFee?: number | null;
  hasElevator?: boolean | null;
  parkingType?: string | null;
  parkingRent?: number | null;
  parkingIncluded?: boolean | null;
  petsAllowed?: boolean | null;
  taxDeductible?: boolean | null;
  rentSubsidy?: boolean | null;
  viewingMethod?: string | null;
  orientation?: string | null;
  legalUsage?: string | null;
  usageZoning?: string | null;
  coverImage?: string | null;
  videoUrl?: string | null;
  images?: string[];
  features?: string[];
  createdByUsername?: string | null;
  contactName?: string;
  furnitureProvided?: FurnitureApplianceValue;
  applianceProvided?: FurnitureApplianceValue;
  furnitureItems?: string[];
  equipmentItems?: string[];
  shortTermRent?: string | null;
  serviceFee?: string | null;
  registrationUse?: string | null;
  securityDeposit?: string | null;
  availableFrom?: string | null;
  householdsPerFloor?: string | null;
  isPublished: boolean;
  unpublishCategory?: "DEAL" | "PAUSE" | "OTHER" | null;
  unpublishNote?: string | null;
  expectedReleaseDate?: string | null;
  unpublishedAt?: string | null;
  createdAt: Date;
};

type AdminListingTableProps = {
  listings: AdminListing[];
  listingType: "RENT" | "SALE";
  currentUsername: string;
  isSuperAdmin: boolean;
  /** 手機版：在表頭顯示「租賃/買賣物件」與篩選按鈕 */
  showMobileSectionTitle?: boolean;
};

type TriFilter = "ALL" | "YES" | "NO";
type OwnerFilter = "ALL" | "MINE" | "RERENT";

function syncOwnerFilterQuery(
  view: OwnerFilter,
  pathname: string,
  router: ReturnType<typeof useRouter>,
  searchParams: URLSearchParams | null,
) {
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  if (view === "RERENT") {
    params.set("view", "rerent");
    params.delete("mine");
  } else if (view === "MINE") {
    params.set("mine", "1");
    params.delete("view");
  } else {
    params.delete("view");
    params.delete("mine");
  }
  const q = params.toString();
  router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
}

function formatAdminPrice(price: number, type: "RENT" | "SALE") {
  if (type === "RENT") return `NT$ ${price.toLocaleString("zh-TW")} / 月`;
  if (price >= 100000000) return `${(price / 100000000).toFixed(1)} 億`;
  return `${(price / 10000).toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;
}

export function AdminListingTable({
  listings,
  listingType,
  currentUsername,
  isSuperAdmin,
  showMobileSectionTitle = false,
}: AdminListingTableProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const searchParams = useSearchParams();
  const initialRerent = searchParams?.get("view") === "rerent";
  const initialMine = searchParams?.get("mine") === "1";
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(
    initialRerent ? "RERENT" : initialMine ? "MINE" : "ALL",
  );
  const [mineStatusFilter, setMineStatusFilter] = useState<"ALL" | "UNPUBLISHED">("ALL");

  useEffect(() => {
    if (searchParams?.get("view") === "rerent") {
      setOwnerFilter("RERENT");
      return;
    }
    if (searchParams?.get("mine") === "1") {
      setOwnerFilter("MINE");
      setMineStatusFilter("ALL");
      return;
    }
    if (!searchParams?.get("view") && !searchParams?.get("mine")) {
      setOwnerFilter("ALL");
    }
  }, [searchParams]);

  useEffect(() => {
    if (listingType !== "RENT" && ownerFilter === "RERENT") {
      setOwnerFilter("ALL");
    }
  }, [listingType, ownerFilter]);

  const rerentCount = useMemo(
    () => filterUpcomingRentListings(listings, { currentUsername, isSuperAdmin }).length,
    [listings, currentUsername, isSuperAdmin],
  );

  function selectOwnerFilter(next: OwnerFilter) {
    setOwnerFilter(next);
    if (next === "MINE") setMineStatusFilter("ALL");
    syncOwnerFilterQuery(next, pathname, router, searchParams);
  }
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    const furnitureForTriFilter = (v: FurnitureApplianceValue | undefined): boolean | null =>
      v === true ? true : v === false ? false : null;

    const base = listings
      .filter((l) => l.listingType === listingType)
      .filter((l) => {
        if (ownerFilter === "RERENT") {
          return computeIsUpcomingRelease({
            isPublished: l.isPublished,
            expectedReleaseDate: l.expectedReleaseDate,
          });
        }
        if (ownerFilter === "MINE" && mineStatusFilter === "UNPUBLISHED") return !l.isPublished;
        // 「上架中」分頁也納入「即將釋出」物件，方便置頂提醒
        if (l.isPublished) return true;
        return computeIsUpcomingRelease({
          isPublished: l.isPublished,
          expectedReleaseDate: l.expectedReleaseDate,
        });
      })
      .filter((l) => {
        if (ownerFilter === "RERENT") {
          return canViewRerentListing(l, { currentUsername, isSuperAdmin });
        }
        if (ownerFilter === "ALL") return true;
        return l.createdByUsername === currentUsername;
      })
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
      .filter((l) => (listingType === "RENT" ? passTri(furnitureForTriFilter(l.furnitureProvided), furnitureFilter) : true))
      .filter((l) => (listingType === "RENT" ? passTri(furnitureForTriFilter(l.applianceProvided), applianceFilter) : true))
      .filter((l) => (parkingFilter === "ALL" ? true : parkingFilter === "YES" ? Boolean(l.parkingType) : !l.parkingType))
      .filter((l) => {
        if (!text) return true;
        const hay = `${l.title}${l.city}${l.district}${l.address ?? ""}${l.community ?? ""}`.toLowerCase();
        return hay.includes(text);
      })
      ;

    if (ownerFilter === "RERENT") {
      return sortUpcomingRentListingsNewestFirst(base);
    }

    return base.sort((a, b) => {
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
      if (aUp && bUp) {
        const aDays = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
        const bDays = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [
    listings,
    listingType,
    ownerFilter,
    mineStatusFilter,
    currentUsername,
    isSuperAdmin,
    city,
    district,
    minPrice,
    maxPrice,
    minRooms,
    maxRooms,
    minPing,
    maxPing,
    layoutFilter,
    taxFilter,
    subsidyFilter,
    petsFilter,
    elevatorFilter,
    furnitureFilter,
    applianceFilter,
    parkingFilter,
    keyword,
  ]);

  const sectionTitle = listingType === "RENT" ? "租賃物件" : "買賣物件";

  return (
    <div>
      {showMobileSectionTitle ? (
        <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
          <h2 className="text-base font-bold text-zinc-900">{sectionTitle}</h2>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="shrink-0 text-sm font-semibold text-[#0b2545]"
          >
            篩選條件 {filtersOpen ? "▲" : "▼"}
          </button>
        </div>
      ) : null}

      <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
        <div
          className={`space-y-3 p-4 ${
            showMobileSectionTitle ? (filtersOpen ? "block" : "hidden") : "block"
          } md:block`}
        >
        <p className="hidden text-sm font-semibold text-zinc-900 md:block">快速篩選條件</p>
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
          {listingType === "RENT" ? (<><select value={taxFilter} onChange={(e) => setTaxFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">報稅不限</option><option value="YES">可報稅</option><option value="NO">不可報稅</option></select><select value={subsidyFilter} onChange={(e) => setSubsidyFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">租補不限</option><option value="YES">可租補</option><option value="NO">不可租補</option></select><select value={petsFilter} onChange={(e) => setPetsFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">寵物不限</option><option value="YES">可養寵物</option><option value="NO">不可養寵物</option></select><select value={furnitureFilter} onChange={(e) => setFurnitureFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">家具不限</option><option value="YES">有家具</option><option value="NO">無家具</option></select><select value={applianceFilter} onChange={(e) => setApplianceFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">設備不限</option><option value="YES">有設備</option><option value="NO">無設備</option></select></>) : null}
          <select value={elevatorFilter} onChange={(e) => setElevatorFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">電梯不限</option><option value="YES">有電梯</option><option value="NO">無電梯</option></select>
          <select value={parkingFilter} onChange={(e) => setParkingFilter(e.target.value as TriFilter)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"><option value="ALL">車位不限</option><option value="YES">有車位</option><option value="NO">無車位</option></select>
          <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋 標題 / 社區 / 地址" className="w-full basis-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm md:ml-auto md:w-64 md:rounded-full md:py-1.5 md:text-xs" />
        </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <div className="flex flex-wrap gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => selectOwnerFilter("ALL")}
            className={`min-w-[4.5rem] px-3 py-2.5 text-sm font-medium max-sm:px-2.5 max-sm:text-xs ${ownerFilter === "ALL" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => selectOwnerFilter("MINE")}
            className={`min-w-[4.5rem] border-l border-zinc-200 px-3 py-2.5 text-sm font-medium max-sm:min-w-0 max-sm:px-2.5 max-sm:text-xs ${ownerFilter === "MINE" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
          >
            我刊登
          </button>
          {listingType === "RENT" ? (
            <button
              type="button"
              onClick={() => selectOwnerFilter("RERENT")}
              className={`inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 border-l border-zinc-200 px-3 py-2.5 text-sm font-medium max-sm:min-w-0 max-sm:px-2.5 max-sm:text-xs ${ownerFilter === "RERENT" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
            >
              回租
              {rerentCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    ownerFilter === "RERENT" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {rerentCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
        {ownerFilter === "MINE" ? (
          <div className="inline-flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setMineStatusFilter("ALL")}
              className={`min-w-[4rem] px-4 py-2.5 text-sm font-medium ${mineStatusFilter === "ALL" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
            >
              上架
            </button>
            <button
              type="button"
              onClick={() => setMineStatusFilter("UNPUBLISHED")}
              className={`min-w-[4rem] border-l border-zinc-200 px-4 py-2.5 text-sm font-medium ${mineStatusFilter === "UNPUBLISHED" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
            >
              下架
            </button>
          </div>
        ) : null}
        </div>
        <span className="text-sm text-zinc-500 sm:ml-auto">
          {ownerFilter === "RERENT" && !isSuperAdmin ? (
            <span className="mr-2 text-xs text-zinc-400">僅顯示你刊登的回租案件</span>
          ) : null}
          符合條件共 <strong className="text-zinc-900">{filtered.length}</strong> 筆
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          {ownerFilter === "RERENT"
            ? "目前沒有 2 個月內預計釋出的租案。"
            : "此分類目前沒有房源。"}
        </p>
      ) : (
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
            const currentVideoUrl = safeImage(l.videoUrl ?? null);
            const imageKey = `${l.id}:${currentImageUrl ?? ""}`;
            const canShowImage = Boolean(currentImageUrl && !brokenImageSet[imageKey]);
            const visibleAddressDetail = formatVisibleAddressDetail(l, isSuperAdmin || l.createdByUsername === currentUsername);
            const addressLine = `${l.city}${l.district}${visibleAddressDetail || ""}`;
            const listedDate = new Intl.DateTimeFormat("zh-TW").format(l.createdAt);
            const upcoming = computeIsUpcomingRelease({
              isPublished: l.isPublished,
              expectedReleaseDate: l.expectedReleaseDate,
            });
            const daysUntilRelease = getDaysUntilRelease(l.expectedReleaseDate);
            const articleClass = upcoming
              ? "overflow-hidden rounded-2xl border-2 border-amber-400 bg-amber-50/40 shadow-sm ring-1 ring-amber-200"
              : "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm";

            return (
              <article key={l.id} className={articleClass}>
                {upcoming ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-100/80 px-3 py-1.5 text-xs font-semibold text-amber-900 md:px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>⏰</span>
                      即將釋出
                      {daysUntilRelease != null ? (
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                          {daysUntilRelease === 0 ? "今日釋出" : `剩 ${daysUntilRelease} 天`}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-amber-800/90">
                      預計釋出 {formatRocDate(l.expectedReleaseDate)}
                      {l.unpublishCategory ? ` · ${unpublishCategoryLabel(l.unpublishCategory)}` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-col md:grid md:grid-cols-[210px_1fr] lg:grid-cols-[225px_1fr]">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 md:self-start">
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
                    ) : currentVideoUrl ? (
                      <video
                        src={currentVideoUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        controls
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-500">無圖片</div>
                    )}
                  </div>

                  <div className="border-b border-zinc-100 px-3 py-3 md:hidden">
                    <Link
                      href={`/listings/${l.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="點擊查看客人外網廣告"
                      className="line-clamp-2 text-base font-bold leading-snug text-zinc-950 hover:text-[#0b2545] hover:underline"
                    >
                      {l.propertyType === "SUITE" && l.roomNumber ? (
                        <span className="mr-1.5 rounded bg-[#0b2545]/10 px-1.5 py-0.5 align-middle text-[11px] font-bold text-[#0b2545]">
                          房號 {l.roomNumber}
                        </span>
                      ) : null}
                      {l.title}
                    </Link>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{addressLine || "—"}</p>
                  </div>

                  <div className="hidden flex-col justify-start gap-3 p-4 md:flex md:px-4 md:pb-3 md:pt-2 lg:px-5 lg:pt-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/listings/${l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="點擊查看客人外網廣告"
                          className="line-clamp-2 text-lg font-bold leading-snug text-zinc-950 hover:text-[#0b2545] hover:underline"
                        >
                          {l.propertyType === "SUITE" && l.roomNumber ? (
                            <span className="mr-1.5 rounded bg-[#0b2545]/10 px-1.5 py-0.5 align-middle text-xs font-bold text-[#0b2545]">
                              房號 {l.roomNumber}
                            </span>
                          ) : null}
                          {l.title}
                        </Link>
                        <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600 md:text-[15px]">{addressLine}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm">
                        <span className="whitespace-nowrap text-zinc-600">
                          業務 <span className="font-semibold text-zinc-900">{l.createdByUsername ?? "—"}</span>
                        </span>
                        <span className="whitespace-nowrap text-zinc-600">
                          上架 <span className="font-semibold text-zinc-900">{listedDate}</span>
                        </span>
                        {canEdit ? (
                          <Link href={`/admin/listings/${l.id}/edit`} className={desktopCardActionBtn}>
                            修改內容
                          </Link>
                        ) : null}
                        {canEdit ? (
                          <ToggleListingButton
                            listingId={l.id}
                            isPublished={l.isPublished}
                            listingType={l.listingType}
                            buttonClassName={l.isPublished ? desktopUnpublishBtn : desktopPublishBtn}
                            wrapperClassName="inline-flex items-center gap-2"
                          />
                        ) : null}
                        {canEdit && l.isPublished ? (
                          <ListingDealCloseButton
                            id={l.id}
                            title={l.title}
                            listingType={l.listingType}
                            price={l.price}
                            serviceFee={l.serviceFee}
                            createdByUsername={l.createdByUsername}
                            contactName={l.contactName ?? ""}
                            city={l.city}
                            district={l.district}
                            address={l.address}
                            community={l.community}
                            isPublished={l.isPublished}
                            buttonClassName={desktopDealBtn}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(140px,1fr)_minmax(180px,1.35fr)_minmax(110px,0.8fr)_minmax(120px,0.9fr)] gap-x-6 gap-y-2 md:mt-1.5">
                      <InfoStat label="價格" value={formatAdminPrice(l.price, l.listingType)} emphasized />
                      <InfoStat label="格局" value={formatLayout(l)} emphasized />
                      <InfoStat label="權狀坪數" value={formatPing(l.areaPing)} emphasized />
                      <InfoStat label="樓層" value={formatFloor(l.floor, l.totalFloors)} emphasized />
                    </div>
                  </div>
                </div>

                <details className="group border-t border-zinc-100 bg-zinc-50 text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1 py-3 text-sm font-semibold text-[#0b2545] md:py-0.5 [&::-webkit-details-marker]:hidden">
                    <span className="md:hidden">展開詳情</span>
                    <span
                      aria-hidden
                      className="inline-block text-base text-zinc-400 transition-transform duration-200 group-open:rotate-180 md:text-zinc-500"
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-zinc-100 px-3 pb-3 pt-2 md:hidden">
                    <div className="grid grid-cols-2 gap-2">
                      <InfoStat label="價格" value={formatAdminPrice(l.price, l.listingType)} />
                      <InfoStat label="格局" value={formatLayout(l)} />
                      <InfoStat label="權狀坪數" value={formatPing(l.areaPing)} />
                      <InfoStat label="樓層" value={formatFloor(l.floor, l.totalFloors)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-zinc-500">
                        業務 <span className="font-semibold text-zinc-700">{l.createdByUsername ?? "—"}</span>
                        {" · 上架 "}
                        <span className="font-semibold text-zinc-700">{new Intl.DateTimeFormat("zh-TW").format(l.createdAt)}</span>
                      </p>
                      {canEdit ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <ToggleListingButton
                            listingId={l.id}
                            isPublished={l.isPublished}
                            listingType={l.listingType}
                            buttonClassName={l.isPublished ? mobileUnpublishBtn : mobilePublishBtn}
                            wrapperClassName="inline-flex items-center gap-1.5"
                          />
                          {l.isPublished ? (
                            <ListingDealCloseButton
                              id={l.id}
                              title={l.title}
                              listingType={l.listingType}
                              price={l.price}
                              serviceFee={l.serviceFee}
                              createdByUsername={l.createdByUsername}
                              contactName={l.contactName ?? ""}
                              city={l.city}
                              district={l.district}
                              address={l.address}
                              community={l.community}
                              isPublished={l.isPublished}
                              buttonClassName={mobileDealBtn}
                            />
                          ) : null}
                          <Link href={`/admin/listings/${l.id}/edit`} className={mobileCardActionBtn}>
                            修改內容
                          </Link>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-100">
                    <DetailRow label="朝向" value={l.orientation} />
                    <DetailRow label="一層幾戶" value={l.householdsPerFloor} />
                    <DetailRow label="主建物" value={formatPing(l.areaMain)} />
                    <DetailRow label="附屬建物" value={formatPing(l.areaAncillary)} />
                    <DetailRow label="車位坪數" value={formatPing(l.areaParkingSpace)} />
                    <DetailRow label="車位樓層/號碼" value={l.parkingSpaceInfo} />
                    <DetailRow
                      label="車位/租金"
                      fullWidth
                      value={`${formatParkingTypeLabel(l.parkingType)}${l.parkingRent ? ` / ${l.parkingRent}/月` : ""}`}
                    />
                    <DetailRow label="電梯" value={triText(l.hasElevator)} />
                    <DetailRow label="屋齡" value={l.buildingAge != null ? `${l.buildingAge}年` : "—"} />
                    <DetailRow label="管理費" value={l.managementFee ? `NT$ ${l.managementFee.toLocaleString("zh-TW")}` : "—"} />
                    <DetailRow label="房屋類型" value={l.legalUsage ?? l.usageZoning ?? "—"} />
                    <DetailRow label="使照登記" value={l.registrationUse} fullWidth />
                    {l.listingType === "RENT" ? (
                      <>
                        <DetailRow label="寵物" value={triText(l.petsAllowed)} />
                        <DetailRow label="報稅" value={triText(l.taxDeductible)} />
                        <DetailRow label="租補" value={triText(l.rentSubsidy)} />
                        <DetailRow label="起租日" value={l.availableFrom} />
                        <DetailRow label="能否短租" value={l.shortTermRent} />
                        <DetailRow label="押金" value={l.securityDeposit} />
                        <DetailRow label="服務費" value={l.serviceFee} fullWidth />
                        <DetailRow label="家具/設備" value={formatFurnitureAndEquipmentZh({ furnitureItems: l.furnitureItems, furnitureLegacy: l.furnitureProvided, equipmentItems: l.equipmentItems, equipmentLegacy: l.applianceProvided })} fullWidth />
                      </>
                    ) : null}
                    <DetailRow label="特色" value={l.features?.filter(Boolean).join(" / ") || "—"} fullWidth />
                    </div>
                  </div>
                  <div className="mt-1 hidden min-w-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-2.5 md:px-10 md:pb-4 md:pt-2 md:text-[15px] md:leading-relaxed md:[&>*:nth-child(3n)]:pl-3 md:[&>*:nth-child(3n+1)]:pr-3 lg:gap-x-10 lg:px-14 lg:[&>*:nth-child(3n)]:pl-4 lg:[&>*:nth-child(3n+1)]:pr-4">
                    <DetailRow label="朝向" value={l.orientation} />
                    <DetailRow label="一層幾戶" value={l.householdsPerFloor} />
                    <DetailRow label="主建物" value={formatPing(l.areaMain)} />
                    <DetailRow label="附屬建物" value={formatPing(l.areaAncillary)} />
                    <DetailRow label="車位坪數" value={formatPing(l.areaParkingSpace)} />
                    <DetailRow label="車位樓層/號碼" value={l.parkingSpaceInfo} />
                    <DetailRow
                      label="車位/租金"
                      value={`${formatParkingTypeLabel(l.parkingType)}${l.parkingRent ? ` / ${l.parkingRent}/月` : ""}`}
                    />
                    <DetailRow label="電梯" value={triText(l.hasElevator)} />
                    <DetailRow label="屋齡" value={l.buildingAge != null ? `${l.buildingAge}年` : "—"} />
                    <DetailRow label="管理費" value={l.managementFee ? `NT$ ${l.managementFee.toLocaleString("zh-TW")}` : "—"} />
                    <DetailRow label="房屋類型" value={l.legalUsage ?? l.usageZoning ?? "—"} />
                    <DetailRow label="使照登記" value={l.registrationUse} />
                    {l.listingType === "RENT" ? (
                      <>
                        <DetailRow label="寵物" value={triText(l.petsAllowed)} />
                        <DetailRow label="報稅" value={triText(l.taxDeductible)} />
                        <DetailRow label="租補" value={triText(l.rentSubsidy)} />
                        <DetailRow label="起租日" value={l.availableFrom} />
                        <DetailRow label="能否短租" value={l.shortTermRent} />
                        <DetailRow label="服務費" value={l.serviceFee} />
                        <DetailRow label="押金" value={l.securityDeposit} />
                        <DetailRow label="家具/設備" value={formatFurnitureAndEquipmentZh({ furnitureItems: l.furnitureItems, furnitureLegacy: l.furnitureProvided, equipmentItems: l.equipmentItems, equipmentLegacy: l.applianceProvided })} />
                      </>
                    ) : null}
                    <DetailRow label="特色" value={l.features?.filter(Boolean).join(" / ") || "—"} />
                  </div>
                </details>
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
function formatPing(v: number | null | undefined) {
  return v == null ? "—" : `${v.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}坪`;
}
function formatLayout(l: Pick<AdminListing, "rooms" | "livingRooms" | "bathrooms" | "balconies">) {
  return `${l.rooms}房 ${l.livingRooms ?? 0}廳 ${l.bathrooms}衛 ${l.balconies ?? 0}陽台`;
}
function formatFloor(floor: number | null | undefined, totalFloors: number | null | undefined) {
  if (floor == null && totalFloors == null) return "—";
  if (floor == null) return `共 ${totalFloors} 樓`;
  if (totalFloors == null) return `${floor} 樓`;
  return `${floor} 樓 / 共 ${totalFloors} 樓`;
}
function maskAddress(address: string | null | undefined) {
  const value = (address ?? "").trim();
  if (!value) return "";
  return value.replace(/\s*\d+\s*號.*$/, "").trim() || value;
}
function stripKnownRegion(address: string | null | undefined, city: string, district: string) {
  let value = (address ?? "").trim();
  for (const prefix of [`${city}${district}`, city, district]) {
    if (prefix && value.startsWith(prefix)) value = value.slice(prefix.length).trim();
  }
  return value;
}
function formatVisibleAddressDetail(l: Pick<AdminListing, "city" | "district" | "address">, canViewFullAddress: boolean) {
  const detail = stripKnownRegion(l.address, l.city, l.district);
  return canViewFullAddress ? detail : maskAddress(detail);
}
function InfoStat({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2 md:bg-transparent md:p-0">
      <p className={emphasized ? "text-xs font-medium text-zinc-500" : "text-[11px] font-medium text-zinc-500 md:text-xs"}>
        {label}
      </p>
      <p
        className={
          emphasized
            ? "mt-1 text-base font-bold leading-snug text-zinc-950 md:text-[17px] md:whitespace-nowrap"
            : "mt-0.5 text-sm font-bold leading-snug text-zinc-950 md:whitespace-nowrap"
        }
      >
        {value}
      </p>
    </div>
  );
}
function DetailRow({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  return (
    <p className={`min-w-0 break-words ${fullWidth ? "col-span-2" : ""}`}>
      <span className="text-zinc-500">{label}：</span>
      <span className="font-medium text-zinc-900">{value || "—"}</span>
    </p>
  );
}
