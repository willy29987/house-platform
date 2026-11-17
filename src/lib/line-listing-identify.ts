/** 把客人給的 591 連結／截圖內容對到官網物件；對不到時保留它的條件做推薦。 */

import { customerListingLabel } from "@/lib/customer-listing-label";
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

/** 與 LIFF 公開地址一致：只到巷／弄，或去掉門牌號。 */
function guestFacingAddress(address: string) {
  const text = address.replace(/\s+/g, "").trim();
  if (!text) return "";
  const alley = text.match(/^(.*弄)/);
  if (alley?.[1]) return alley[1];
  const lane = text.match(/^(.*巷)/);
  if (lane?.[1]) return lane[1];
  return text.replace(/\d*號.*$/, "").trim();
}

/** 比對用：去掉縣市區後的公開地址，避免截圖沒寫「新北市」就對不上。 */
function guestAddressKey(address: string, city: string, district: string) {
  let plain = normalizeText(guestFacingAddress(address));
  if (!plain) return "";
  const cityKey = normalizeText(city);
  const districtKey = normalizeText(district);
  if (cityKey) plain = plain.replace(cityKey, "");
  if (districtKey) plain = plain.replace(districtKey, "");
  return plain;
}

function sameCityName(a: string, b: string) {
  return a.replace(/臺/g, "台") === b.replace(/臺/g, "台");
}

/**
 * 從 AI 讀到的標籤字串補齊欄位（自家 LIFF 標題常是「板橋區 · 2房1衛 · 12坪 · 12,000 元/月」）。
 */
export function enrichInfoFromScreenshotText(
  info: Partial<ExternalListingInfo>,
): Partial<ExternalListingInfo> {
  const blob = `${info.title ?? ""} ${info.address ?? ""} ${info.district ?? ""} ${info.city ?? ""}`;
  const next: Partial<ExternalListingInfo> = { ...info };

  if (!next.district) {
    const district = blob.match(/([\u4e00-\u9fff]{1,3}[縣市])?([\u4e00-\u9fff]{1,4}[區市鄉鎮])/)?.[2];
    if (district) next.district = district;
  }
  if (!next.city) {
    const city = blob.match(/(台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|嘉義市)/)?.[1];
    if (city) next.city = city.replace(/^臺/, "台");
  }
  if (!next.rooms) {
    const rooms = blob.match(/(\d+)\s*房/);
    if (rooms) next.rooms = Number(rooms[1]);
  }
  if (next.areaPing == null || next.areaPing <= 0) {
    const area = blob.match(/(\d+(?:\.\d+)?)\s*坪/);
    if (area) next.areaPing = Number(area[1]);
  }
  if (!next.price) {
    const price = blob.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*元/);
    if (price) next.price = toNumber(price[1]);
  }
  if (!next.address) {
    const addr = blob.match(/([\u4e00-\u9fff0-9]+(?:路|街|道|大道)[\u4e00-\u9fff0-9]*(?:巷[\u4e00-\u9fff0-9]*)?(?:弄[\u4e00-\u9fff0-9]*)?)/);
    if (addr?.[1]) next.address = addr[1];
  }
  if (!next.houseCondition) {
    if (blob.includes("獨立套房")) next.houseCondition = "STUDIO";
    else if (blob.includes("分租套房") || blob.includes("雅房")) next.houseCondition = "SUITE";
  }

  return next;
}

/**
 * 591 上別的編號／截圖，其實是官網同一間（重刊、換編號）時找出來。
 * 自家 LIFF／官網截圖則用客人可見標籤（區／房／坪／價）與公開地址對。
 * 只在同縣市行政區內比，避免誤配。
 */
export function findOwnListingByFeatures(
  info: Partial<ExternalListingInfo>,
  listings: RentalMatchListing[],
): RentalMatchListing | null {
  const filled = enrichInfoFromScreenshotText(info);
  const title = filled.title?.trim() ?? "";
  const price = filled.price ?? 0;

  const labelSoftHits = new Set<string>();
  if (title) {
    for (const listing of listings) {
      const guestLabel = customerListingLabel(
        { ...listing, listingType: "RENT" },
        { withPrice: true },
      );
      const guestLabelPlain = customerListingLabel({ ...listing, listingType: "RENT" });
      const soft = Math.max(titleSimilarity(title, guestLabel), titleSimilarity(title, guestLabelPlain));
      if (soft >= 0.75) labelSoftHits.add(listing.id);
    }
  }
  const uniqueGuestLabel = labelSoftHits.size === 1;

  const scored: { listing: RentalMatchListing; score: number }[] = [];

  for (const listing of listings) {
    if (filled.city && listing.city && !sameCityName(filled.city, listing.city)) continue;
    if (filled.district && listing.district && filled.district !== listing.district) continue;

    const guestLabel = customerListingLabel(
      { ...listing, listingType: "RENT" },
      { withPrice: true },
    );
    const guestLabelPlain = customerListingLabel({ ...listing, listingType: "RENT" });
    const backendTitleSim = title ? titleSimilarity(title, listing.title) : 0;
    const guestLabelSim = title
      ? Math.max(titleSimilarity(title, guestLabel), titleSimilarity(title, guestLabelPlain))
      : 0;
    const similarity = Math.max(backendTitleSim, guestLabelSim);

    const priceClose = price > 0 && Math.abs(listing.price - price) <= Math.max(500, price * 0.03);
    const street = filled.address ? streetName(filled.address, listing.city, listing.district) : "";
    const sameStreet =
      Boolean(street) && street === streetName(listing.address, listing.city, listing.district);
    const guestAddr = filled.address
      ? guestAddressKey(filled.address, listing.city, listing.district)
      : "";
    const listingGuestAddr = guestAddressKey(listing.address, listing.city, listing.district);
    const sameGuestAddr = Boolean(guestAddr) && guestAddr === listingGuestAddr;
    const sameRooms = Boolean(filled.rooms) && filled.rooms === listing.rooms;
    const areaClose =
      filled.areaPing != null &&
      listing.areaPing > 0 &&
      Math.abs(listing.areaPing - filled.areaPing) <= 1;
    const sameCondition =
      Boolean(filled.houseCondition) &&
      Boolean(listing.houseCondition) &&
      filled.houseCondition === listing.houseCondition;
    const hasPlaceAnchor = sameStreet || sameGuestAddr;

    /** 自家找房卡上常見：區＋租金＋房數＋坪數 */
    const liffFingerprint =
      Boolean(filled.district || filled.city) && priceClose && sameRooms && areaClose;

    let score = 0;
    // 後台案件標題對得上，或客人標籤全場唯一時，才用高相似度直接認定
    if (backendTitleSim >= 0.75 || (guestLabelSim >= 0.75 && (uniqueGuestLabel || hasPlaceAnchor))) {
      score = 3 + similarity;
    } else if (hasPlaceAnchor && priceClose && (sameRooms || areaClose)) {
      score = 3.2;
    } else if (hasPlaceAnchor && priceClose) {
      score = 2.8;
    } else if (liffFingerprint && (hasPlaceAnchor || sameCondition)) {
      score = 2.6;
    } else if (liffFingerprint && uniqueGuestLabel) {
      score = 2.4;
    } else if (priceClose && guestLabelSim >= 0.5 && hasPlaceAnchor) {
      score = 2 + guestLabelSim;
    } else if (priceClose && sameStreet && (sameRooms || areaClose)) {
      score = 2;
    } else if (liffFingerprint) {
      // 同區同條件可能多間：先記分，後面用領先幅度決定是否採用
      score = 2.15;
    }

    if (score > 0) scored.push({ listing, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  const second = scored[1];
  // 僅靠區房坪價、又沒地址錨點時，必須明顯領先第二名
  if (best.score < 2.6 && second && best.score - second.score < 0.25) return null;
  if (second && Math.abs(best.score - second.score) < 0.05) return null;

  return best.listing;
}

export function describeExternalListing(info: Partial<ExternalListingInfo>) {
  const parts = [
    `${info.city ?? ""}${info.district ?? ""}`,
    info.houseCondition === "STUDIO" ? "套房" : info.rooms ? `${info.rooms}房` : "",
    info.price ? `約 ${Math.round(info.price).toLocaleString("zh-TW")} 元` : "",
  ].filter(Boolean);
  return parts.join("・");
}
