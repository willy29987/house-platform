/** 把客人給的 591 連結／截圖內容對到官網物件；對不到時保留它的條件做推薦。 */

import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export type ExternalListingInfo = {
  source591Id: string;
  title: string;
  price: number;
  city: string;
  district: string;
  address: string;
  rooms: number;
  houseCondition: string;
  propertyType: string;
  areaPing: number | null;
};

function toNumber(raw: unknown): number {
  const value = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** 讀 591 物件頁（官網沒有這間時，用來比對同屋或推薦類似）。 */
export async function fetch591ListingInfo(
  source591Id: string,
  sourceUrl?: string | null,
  budgetMs = 8000,
): Promise<ExternalListingInfo | null> {
  const id = source591Id.trim();
  if (!/^\d{5,}$/.test(id)) return null;
  try {
    const { import591ListingFromUrl } = await import("@/lib/listing-591-import");
    const draft = await withTimeout(
      import591ListingFromUrl(sourceUrl?.trim() || `https://rent.591.com.tw/${id}`),
      budgetMs,
    );
    if (!draft) return null;
    return {
      source591Id: id,
      title: draft.title,
      price: toNumber(draft.price),
      city: draft.city,
      district: draft.district,
      address: draft.address,
      rooms: Math.round(toNumber(draft.rooms)),
      houseCondition: draft.houseCondition,
      propertyType: draft.propertyType,
      areaPing: toNumber(draft.areaPing) || null,
    };
  } catch (error) {
    console.warn("[line-listing-identify] fetch 591 failed", id, error);
    return null;
  }
}

function normalizeText(raw: string) {
  return raw
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .toLowerCase();
}

function bigrams(text: string) {
  const grams = new Set<string>();
  for (let i = 0; i < text.length - 1; i += 1) grams.add(text.slice(i, i + 2));
  return grams;
}

function titleSimilarity(a: string, b: string) {
  const left = bigrams(normalizeText(a));
  const right = bigrams(normalizeText(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

/** 取到「路／街／道／大道」為止的路名 */
function streetName(address: string, city: string, district: string) {
  const plain = normalizeText(address).replace(normalizeText(city), "").replace(normalizeText(district), "");
  const match = plain.match(/^(.+?(?:大道|路|街|道))/);
  return match?.[1] ?? "";
}

/**
 * 591 上別的編號／截圖，其實是官網同一間（重刊、換編號）時找出來。
 * 只在同縣市行政區內比，避免誤配。
 */
export function findOwnListingByFeatures(
  info: Partial<ExternalListingInfo>,
  listings: RentalMatchListing[],
): RentalMatchListing | null {
  const title = info.title?.trim() ?? "";
  const price = info.price ?? 0;
  let best: { listing: RentalMatchListing; score: number } | null = null;

  const sameCity = (a: string, b: string) => a.replace(/臺/g, "台") === b.replace(/臺/g, "台");
  for (const listing of listings) {
    if (info.city && listing.city && !sameCity(info.city, listing.city)) continue;
    if (info.district && listing.district && info.district !== listing.district) continue;

    const similarity = title ? titleSimilarity(title, listing.title) : 0;
    const priceClose = price > 0 && Math.abs(listing.price - price) <= Math.max(500, price * 0.03);
    const street = info.address ? streetName(info.address, listing.city, listing.district) : "";
    const sameStreet =
      Boolean(street) && street === streetName(listing.address, listing.city, listing.district);
    const sameRooms = Boolean(info.rooms) && info.rooms === listing.rooms;
    const areaClose =
      info.areaPing != null && listing.areaPing > 0 && Math.abs(listing.areaPing - info.areaPing) <= 1;

    let score = 0;
    if (similarity >= 0.75) score = 3 + similarity;
    else if (priceClose && similarity >= 0.5) score = 2 + similarity;
    else if (priceClose && sameStreet && (sameRooms || areaClose)) score = 2;
    if (score > 0 && (!best || score > best.score)) best = { listing, score };
  }
  return best?.listing ?? null;
}

export function describeExternalListing(info: Partial<ExternalListingInfo>) {
  const parts = [
    `${info.city ?? ""}${info.district ?? ""}`,
    info.houseCondition === "STUDIO" ? "套房" : info.rooms ? `${info.rooms}房` : "",
    info.price ? `約 ${Math.round(info.price).toLocaleString("zh-TW")} 元` : "",
  ].filter(Boolean);
  return parts.join("・");
}
