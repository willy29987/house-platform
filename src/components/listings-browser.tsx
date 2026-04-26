"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { ListingCard } from "@/lib/listings";
import { ListingCardItem } from "@/components/listing-card";

type Props = {
  listingType: "RENT" | "SALE";
  listings: ListingCard[];
};

type Category = "residential" | "office" | "shop";

const CATEGORIES: { key: Category; label: string; types: string[] }[] = [
  { key: "residential", label: "住宅", types: ["APARTMENT", "HOUSE", "STUDIO"] },
  { key: "office", label: "辦公室", types: ["OFFICE"] },
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

  const category = (sp.get("category") as Category) || "residential";
  const city = sp.get("city") ?? "";
  const district = sp.get("district") ?? "";
  const rooms = sp.get("rooms") ?? "";
  const priceKey = sp.get("price") ?? "";
  const parking = sp.get("parking") ?? "";
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
  }, [listings, category, city, district, rooms, priceKey, parking, sort, priceOptions]);

  const activeFilterCount = [city, district, rooms, priceKey, parking].filter(Boolean).length;

  const heroTitle = isRent ? "找住宅" : "買好房";
  const heroSubtitle = isRent
    ? "篩選你的理想租屋，從地段、預算到格局一次搞定"
    : "從小宅到豪宅，找到最適合你的家";
  const heroImage = isRent
    ? "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1920&q=80"
    : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80";

  return (
    <main>
      {/* Hero + 篩選列 */}
      <section className="relative h-[480px] w-full overflow-hidden bg-[#0b2545] sm:h-[540px]">
        <Image
          src={heroImage}
          alt={heroTitle}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/20" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-between px-6 py-10 text-white sm:px-10">
          <div className="max-w-xl">
            <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg sm:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-3 text-sm text-white/85 sm:text-base">{heroSubtitle}</p>
          </div>

          {/* 類別分頁 */}
          <div className="mt-auto">
            <div className="inline-flex rounded-full bg-white/95 p-1.5 shadow-lg">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => update("category", c.key === "residential" ? "" : c.key)}
                    className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[#0b2545] text-white shadow"
                        : "text-zinc-700 hover:text-[#0b2545]"
                    }`}
                  >
                    {active && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#f4d58a]" />
                    )}
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* 篩選列 */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/97 p-3 shadow-xl backdrop-blur">
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
              ) : null}
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

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                >
                  清除 ({activeFilterCount})
                </button>
              ) : null}

              <span className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2545] text-white shadow-md">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 排序 + 結果 */}
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            共 <span className="font-semibold text-zinc-900">{filtered.length}</span> 筆符合條件的物件
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-500">排序方式</label>
            <select
              value={sort}
              onChange={(e) => update("sort", e.target.value === "default" ? "" : e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
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
