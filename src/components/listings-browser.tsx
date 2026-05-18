"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ListingCard } from "@/lib/listings";
import { ListingCardItem } from "@/components/listing-card";
import { listingMatchesMrtLines, TAIPEI_MRT_FILTER_LINES } from "@/lib/mrt";

type Props = {
  listingType: "RENT" | "SALE";
  listings: ListingCard[];
};

type Category = "residential" | "office" | "shop";

const CATEGORIES: { key: Category; label: string; types: string[] }[] = [
  { key: "residential", label: "住家", types: ["APARTMENT", "HOUSE", "STUDIO"] },
  { key: "office", label: "辦公", types: ["OFFICE"] },
  { key: "shop", label: "店面", types: ["SHOP"] },
];

const ROOM_OPTIONS = [
  { value: "", label: "不限" },
  { value: "1", label: "1 房" },
  { value: "2", label: "2 房" },
  { value: "3", label: "3 房" },
  { value: "4", label: "4 房以上" },
];

const PARKING_OPTIONS = [
  { value: "", label: "不限" },
  { value: "yes", label: "有車位" },
  { value: "no", label: "無車位" },
];

const RENT_PRICE_OPTIONS = [
  { value: "", label: "不限", min: 0, max: Infinity },
  { value: "0-10000", label: "1 萬以下", min: 0, max: 10000 },
  { value: "10000-20000", label: "1 - 2 萬", min: 10000, max: 20000 },
  { value: "20000-30000", label: "2 - 3 萬", min: 20000, max: 30000 },
  { value: "30000-50000", label: "3 - 5 萬", min: 30000, max: 50000 },
  { value: "50000-100000", label: "5 - 10 萬", min: 50000, max: 100000 },
  { value: "100000-", label: "10 萬以上", min: 100000, max: Infinity },
];

const SALE_PRICE_OPTIONS = [
  { value: "", label: "不限", min: 0, max: Infinity },
  { value: "0-5000000", label: "500 萬以下", min: 0, max: 5_000_000 },
  { value: "5000000-10000000", label: "500 - 1000 萬", min: 5_000_000, max: 10_000_000 },
  { value: "10000000-20000000", label: "1000 - 2000 萬", min: 10_000_000, max: 20_000_000 },
  { value: "20000000-40000000", label: "2000 - 4000 萬", min: 20_000_000, max: 40_000_000 },
  { value: "40000000-80000000", label: "4000 - 8000 萬", min: 40_000_000, max: 80_000_000 },
  { value: "80000000-", label: "8000 萬以上", min: 80_000_000, max: Infinity },
];

const SORT_OPTIONS = [
  { value: "default", label: "預設排序" },
  { value: "newest", label: "最新上架" },
  { value: "price-asc", label: "價格由低到高" },
  { value: "price-desc", label: "價格由高到低" },
  { value: "area-desc", label: "坪數由大到小" },
];

export function ListingsBrowser({ listingType, listings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const category = (sp.get("category") as Category) || "residential";
  const city = sp.get("city") ?? "";
  const district = sp.get("district") ?? "";
  const rooms = sp.get("rooms") ?? "";
  const priceKey = sp.get("price") ?? "";
  const parking = sp.get("parking") ?? "";
  const taxFilter = sp.get("tax") === "1";
  const subsidyFilter = sp.get("subsidy") === "1";
  const registerFilter = sp.get("register") === "1";
  const petsFilter = sp.get("pets") === "1";
  const furnitureFilter = sp.get("furniture") === "1";
  const applianceFilter = sp.get("appliance") === "1";
  const selectedMrtLines = (sp.get("mrt") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sort = sp.get("sort") ?? "default";

  const isRent = listingType === "RENT";
  const priceOptions = isRent ? RENT_PRICE_OPTIONS : SALE_PRICE_OPTIONS;

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    if (key === "city") params.delete("district");
    if (key === "category") {
      params.delete("rooms");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleFlag(
    key: "tax" | "subsidy" | "register" | "pets" | "furniture" | "appliance",
    checked: boolean,
  ) {
    const params = new URLSearchParams(sp.toString());
    if (checked) params.set(key, "1");
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleMrtLine(lineId: string, checked: boolean) {
    const params = new URLSearchParams(sp.toString());
    const next = new Set(selectedMrtLines);
    if (checked) next.add(lineId);
    else next.delete(lineId);
    if (next.size > 0) params.set("mrt", [...next].join(","));
    else params.delete("mrt");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.city))).sort(),
    [listings],
  );
  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          listings
            .filter((l) => !city || l.city === city)
            .map((l) => l.district),
        ),
      ).sort(),
    [listings, city],
  );

  const filtered = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0];
    const allowedTypes = new Set(cat.types);
    const selectedPrice = priceOptions.find((o) => o.value === priceKey);

    const out = listings.filter((l) => {
      if (!allowedTypes.has(l.propertyType)) return false;
      if (city && l.city !== city) return false;
      if (district && l.district !== district) return false;
      if (rooms) {
        const r = parseInt(rooms);
        if (!Number.isNaN(r)) {
          if (r === 4 ? l.rooms < 4 : l.rooms !== r) return false;
        }
      }
      if (selectedPrice) {
        if (l.price < selectedPrice.min || l.price > selectedPrice.max) return false;
      }
      if (parking === "yes" && !(l.areaParkingSpace && l.areaParkingSpace > 0)) return false;
      if (parking === "no" && l.areaParkingSpace && l.areaParkingSpace > 0) return false;
      if (isRent && taxFilter && l.taxDeductible !== true) return false;
      if (isRent && subsidyFilter && l.rentSubsidy !== true) return false;
      if (isRent && registerFilter && l.canRegisterAddress !== true) return false;
      if (isRent && petsFilter && l.petsAllowed !== true) return false;
      if (isRent && furnitureFilter && l.furnitureProvided !== true) return false;
      if (isRent && applianceFilter && l.applianceProvided !== true) return false;
      if (!listingMatchesMrtLines(l.mrtLine, selectedMrtLines)) return false;
      return true;
    });

    const sorted = [...out];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "area-desc":
        sorted.sort((a, b) => b.areaPing - a.areaPing);
        break;
    }
    return sorted;
  }, [
    listings,
    category,
    city,
    district,
    rooms,
    priceKey,
    parking,
    taxFilter,
    subsidyFilter,
    registerFilter,
    petsFilter,
    furnitureFilter,
    applianceFilter,
    selectedMrtLines,
    isRent,
    sort,
    priceOptions,
  ]);

  const activeFilterCount = [
    city,
    district,
    rooms,
    priceKey,
    parking,
    isRent && taxFilter ? "tax" : "",
    isRent && subsidyFilter ? "subsidy" : "",
    isRent && registerFilter ? "register" : "",
    isRent && petsFilter ? "pets" : "",
    isRent && furnitureFilter ? "furniture" : "",
    isRent && applianceFilter ? "appliance" : "",
    ...selectedMrtLines,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!filtersOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const heroTitle = isRent ? "住家" : "買好房";
  const heroSubtitle = isRent
    ? "篩選你的理想租屋，從地段、預算到格局一次搞定"
    : "從小宅到豪宅，找到最適合你的家";
  const heroImage = isRent
    ? "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1920&q=80"
    : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80";

  return (
    <main>
      {/* Hero + 篩選列 */}
      <section className="relative h-[min(52vh,360px)] w-full bg-[#0b2545] sm:h-[min(48vh,420px)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Image
            src={heroImage}
            alt={heroTitle}
            fill
            className="object-cover object-[center_82%] sm:object-[center_76%]"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/20" />
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[90rem] flex-col justify-end px-4 pb-3 pt-8 text-white sm:px-6 sm:pb-4 md:px-10 lg:px-14">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg sm:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-2 text-sm text-white/85 sm:mt-2.5 sm:text-base">{heroSubtitle}</p>
          </div>

          {/* 類別 + 篩選為一整組，水平置中 */}
          <div className="mt-4 flex w-full justify-center sm:mt-5">
            <div className="relative flex flex-wrap items-center justify-center gap-2 lg:flex-nowrap lg:gap-3">
              <div className="inline-flex shrink-0 rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5">
                {CATEGORIES.map((c) => {
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => update("category", c.key === "residential" ? "" : c.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-[#0b2545] text-white shadow-sm"
                          : "text-zinc-700 hover:text-[#0b2545]"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
                aria-label={
                  activeFilterCount > 0
                    ? `篩選條件，已套用 ${activeFilterCount} 項`
                    : "開啟篩選條件"
                }
                title="篩選條件"
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/95 text-[#0b2545] shadow-md ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white ${
                  filtersOpen ? "ring-2 ring-amber-300/80" : ""
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                {activeFilterCount > 0 ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold leading-none text-[#0b2545] ring-2 ring-white"
                    aria-hidden
                  >
                    {activeFilterCount > 9 ? "9+" : activeFilterCount}
                  </span>
                ) : null}
              </button>

            {filtersOpen ? (
              <div
                className="absolute left-1/2 top-full z-[60] mt-2 w-[min(calc(100vw-2rem),36rem)] -translate-x-1/2 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-2xl sm:w-[32rem] sm:p-4 lg:left-auto lg:right-0 lg:w-[40rem] lg:translate-x-0"
                role="dialog"
                aria-label="篩選條件"
              >
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  縣市 · 區域 · 房型 · {isRent ? "租金" : "總價"} · 車位
                  {isRent ? " · 租賃條件 · 捷運" : ""}
                </p>
                <div className="grid max-h-[min(70vh,28rem)] grid-cols-1 gap-2.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
                  <Dropdown
                    label="縣市"
                    value={city}
                    placeholder="不限"
                    options={[{ value: "", label: "不限" }, ...cities.map((c) => ({ value: c, label: c }))]}
                    onChange={(v) => update("city", v)}
                  />
                  <Dropdown
                    label="區域"
                    value={district}
                    placeholder={city ? "不限" : "先選縣市"}
                    disabled={!city}
                    options={[
                      { value: "", label: "不限" },
                      ...districts.map((d) => ({ value: d, label: d })),
                    ]}
                    onChange={(v) => update("district", v)}
                  />
                  {category === "residential" ? (
                    <Dropdown
                      label="房型"
                      value={rooms}
                      placeholder="不限"
                      options={ROOM_OPTIONS}
                      onChange={(v) => update("rooms", v)}
                    />
                  ) : (
                    <div className="hidden lg:block" aria-hidden />
                  )}
                  <Dropdown
                    label={isRent ? "租金 (NTD)" : "總價"}
                    value={priceKey}
                    placeholder="不限"
                    options={priceOptions.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => update("price", v)}
                  />
                  <Dropdown
                    label="車位"
                    value={parking}
                    placeholder="不限"
                    options={PARKING_OPTIONS}
                    onChange={(v) => update("parking", v)}
                  />
                  {category !== "residential" ? (
                    <div className="hidden lg:block" aria-hidden />
                  ) : null}
                  {isRent ? (
                    <>
                      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] font-medium text-zinc-500">租賃條件</span>
                        <div className="flex flex-wrap gap-2 sm:gap-2.5">
                          <FilterCheckbox
                            label="報稅"
                            checked={taxFilter}
                            onChange={(checked) => toggleFlag("tax", checked)}
                          />
                          <FilterCheckbox
                            label="租屋補助"
                            checked={subsidyFilter}
                            onChange={(checked) => toggleFlag("subsidy", checked)}
                          />
                          <FilterCheckbox
                            label="入籍"
                            checked={registerFilter}
                            onChange={(checked) => toggleFlag("register", checked)}
                          />
                          <FilterCheckbox
                            label="寵物"
                            checked={petsFilter}
                            onChange={(checked) => toggleFlag("pets", checked)}
                          />
                          <FilterCheckbox
                            label="家具"
                            checked={furnitureFilter}
                            onChange={(checked) => toggleFlag("furniture", checked)}
                          />
                          <FilterCheckbox
                            label="家電"
                            checked={applianceFilter}
                            onChange={(checked) => toggleFlag("appliance", checked)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                        <span className="text-[11px] font-medium text-zinc-500">台北捷運路線</span>
                        <div className="flex flex-wrap gap-2 sm:gap-2.5">
                          {TAIPEI_MRT_FILTER_LINES.map((line) => (
                            <FilterCheckbox
                              key={line.id}
                              label={line.shortLabel}
                              checked={selectedMrtLines.includes(line.id)}
                              onChange={(checked) => toggleMrtLine(line.id, checked)}
                              lineColor={line.badgeClass}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearAll();
                        setFiltersOpen(false);
                      }}
                      className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                    >
                      清除全部 ({activeFilterCount})
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-full bg-[#0b2545] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e3a8a]"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* 排序 + 結果 */}
      <section className="mx-auto w-full max-w-[90rem] px-4 pb-8 pt-4 sm:px-6 sm:pt-5 md:px-10 lg:px-14">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            共 <span className="font-semibold text-zinc-900">{filtered.length}</span> 筆符合條件的物件
          </div>
          <select
            value={sort}
            onChange={(e) => update("sort", e.target.value === "default" ? "" : e.target.value)}
            aria-label="排序"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 p-12 text-center">
            <p className="text-base font-medium text-zinc-700">找不到符合條件的物件</p>
            <p className="mt-2 text-sm text-zinc-500">試試放寬篩選條件</p>
            <button
              onClick={clearAll}
              className="mt-6 rounded-lg bg-[#0b2545] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
            >
              清除所有篩選
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map((l) => (
              <ListingCardItem key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type DropdownProps = {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
};

function Dropdown({ label, value, placeholder, options, onChange, disabled }: DropdownProps) {
  return (
    <div className="flex min-w-[124px] flex-col">
      <span className="mb-0.5 text-[11px] font-medium text-zinc-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full appearance-none rounded-md border border-zinc-200 bg-white px-3 py-1.5 pr-7 text-sm font-semibold text-zinc-800 focus:border-zinc-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400 ${
            !value ? "text-zinc-500" : ""
          }`}
        >
          <option value="">{placeholder}</option>
          {options
            .filter((o) => o.value !== "")
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

type FilterCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  lineColor?: string;
};

function FilterCheckbox({ label, checked, onChange, lineColor }: FilterCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 transition hover:border-zinc-300 hover:bg-white sm:px-3 sm:py-2">
      {lineColor ? (
        <span className={`h-3 w-3 shrink-0 rounded-sm ${lineColor}`} aria-hidden />
      ) : null}
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${
          checked ? "border-[#0b2545] bg-[#0b2545]" : "border-zinc-300 bg-white"
        }`}
        aria-hidden
      >
        {checked ? (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
