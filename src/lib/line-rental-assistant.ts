/** 租屋 LINE 客服試做：條件可複選，只配對已上架出租物件。 */

import { ListingType } from "@prisma/client";
import { normalizeItemList } from "@/lib/furniture-appliance-value";
import { parseListingInternalMeta } from "@/lib/listing-internal-meta";
import { prisma } from "@/lib/prisma";

export type RentalMatchListing = {
  id: string;
  title: string;
  city: string;
  district: string;
  address: string;
  price: number;
  areaPing: number;
  areaMain: number | null;
  areaAncillary: number | null;
  rooms: number;
  livingRooms: number | null;
  balconies: number | null;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  propertyType: string;
  houseCondition?: string | null;
  hasElevator: boolean | null;
  community: string | null;
  managementFee: number | null;
  parkingType: string | null;
  parkingRent: number | null;
  areaParkingSpace: number | null;
  orientation: string | null;
  petsAllowed: boolean | null;
  coverImage: string | null;
  images: string[];
  features: string[];
  furnitureItems: string[];
  equipmentItems: string[];
  rentSubsidy: boolean | null;
  taxDeductible: boolean | null;
  canRegisterAddress: boolean | null;
  viewingMethod: string | null;
  securityDeposit: string | null;
  availableFrom: string | null;
  shortTermRent: string | null;
  serviceFee: string | null;
};

/** 從網站出租物件卡片轉成 LIFF／客服配對用結構 */
export function toRentalMatchListing(listing: {
  id: string;
  title: string;
  city: string;
  district: string;
  address: string;
  price: number;
  areaPing: number;
  areaMain?: number | null;
  areaAncillary?: number | null;
  rooms: number;
  livingRooms?: number | null;
  balconies?: number | null;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  propertyType?: string;
  houseCondition?: string | null;
  hasElevator?: boolean | null;
  community?: string | null;
  managementFee?: number | null;
  parkingType?: string | null;
  parkingRent?: number | null;
  areaParkingSpace: number | null;
  orientation?: string | null;
  petsAllowed: boolean | null;
  coverImage: string | null;
  images: string[];
  features?: string[] | null;
  furnitureItems?: string[] | null;
  equipmentItems?: string[] | null;
  rentSubsidy: boolean | null;
  taxDeductible: boolean | null;
  canRegisterAddress: boolean | null;
  viewingMethod?: string | null;
  securityDeposit?: string | null;
  availableFrom?: string | null;
  shortTermRent?: string | null;
  serviceFee?: string | null;
}): RentalMatchListing {
  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    district: listing.district,
    address: listing.address,
    price: listing.price,
    areaPing: listing.areaPing,
    areaMain: listing.areaMain ?? null,
    areaAncillary: listing.areaAncillary ?? null,
    rooms: listing.rooms,
    livingRooms: listing.livingRooms ?? null,
    balconies: listing.balconies ?? null,
    bathrooms: listing.bathrooms,
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    propertyType: listing.propertyType ?? "",
    houseCondition: listing.houseCondition ?? null,
    hasElevator: listing.hasElevator ?? null,
    community: listing.community ?? null,
    managementFee: listing.managementFee ?? null,
    parkingType: listing.parkingType ?? null,
    parkingRent: listing.parkingRent ?? null,
    areaParkingSpace: listing.areaParkingSpace,
    orientation: listing.orientation ?? null,
    petsAllowed: listing.petsAllowed,
    coverImage: listing.coverImage,
    images: listing.images,
    features: (listing.features ?? []).filter(Boolean),
    furnitureItems: listing.furnitureItems ?? [],
    equipmentItems: listing.equipmentItems ?? [],
    rentSubsidy: listing.rentSubsidy,
    taxDeductible: listing.taxDeductible,
    canRegisterAddress: listing.canRegisterAddress,
    viewingMethod: listing.viewingMethod ?? null,
    securityDeposit: listing.securityDeposit ?? null,
    availableFrom: listing.availableFrom ?? null,
    shortTermRent: listing.shortTermRent ?? null,
    serviceFee: listing.serviceFee ?? null,
  };
}

/** 已上架出租物件（含詳情欄位）供 LIFF／LINE 配對 */
export async function loadRentalMatchListings(
  take: number | null = 60,
  extraIds: string[] = [],
): Promise<RentalMatchListing[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await prisma.listing.findMany({
      where: { listingType: ListingType.RENT, isPublished: true },
      orderBy: { createdAt: "desc" },
      ...(take != null && take > 0 ? { take } : {}),
    });
    const wanted = [...new Set(extraIds.map((id) => id.trim()).filter(Boolean))];
    const missing = wanted.filter((id) => !rows.some((row) => row.id === id));
    if (missing.length) {
      const extras = await prisma.listing.findMany({
        where: {
          id: { in: missing },
          listingType: ListingType.RENT,
          isPublished: true,
        },
      });
      rows.unshift(...extras);
    }
    return rows.map((row) => {
      const meta = parseListingInternalMeta(row.description);
      return toRentalMatchListing({
        ...row,
        furnitureItems: normalizeItemList(meta.furnitureItems),
        equipmentItems: normalizeItemList(meta.equipmentItems),
        securityDeposit: meta.securityDeposit ?? null,
        availableFrom: meta.availableFrom ?? null,
        shortTermRent: meta.shortTermRent ?? null,
        serviceFee: meta.serviceFee ?? null,
        houseCondition: meta.houseCondition ?? null,
      });
    });
  } catch (error) {
    console.error("[line-rental-assistant] loadRentalMatchListings", error);
    return [];
  }
}

/** 單筆已上架出租物件，供新案推播配對 */
export async function loadPublishedRentalMatchListing(id: string): Promise<RentalMatchListing | null> {
  const listingId = id.trim();
  if (!listingId || !process.env.DATABASE_URL) return null;
  try {
    const row = await prisma.listing.findFirst({
      where: { id: listingId, listingType: ListingType.RENT, isPublished: true },
    });
    if (!row) return null;
    const meta = parseListingInternalMeta(row.description);
    return toRentalMatchListing({
      ...row,
      furnitureItems: normalizeItemList(meta.furnitureItems),
      equipmentItems: normalizeItemList(meta.equipmentItems),
      securityDeposit: meta.securityDeposit ?? null,
      availableFrom: meta.availableFrom ?? null,
      shortTermRent: meta.shortTermRent ?? null,
      serviceFee: meta.serviceFee ?? null,
      houseCondition: meta.houseCondition ?? null,
    });
  } catch (error) {
    console.error("[line-rental-assistant] loadPublishedRentalMatchListing", error);
    return null;
  }
}

/** 推播／591／照片對中後直開：book＝該間詳情；similar＝放寬條件後的配對列表 */
export type LiffDirectListingEntry = {
  listingIds: string[];
  criteria: RentalMatchCriteria;
  priceMin: number | null;
  priceMax: number | null;
  petNote: string;
  mode?: "book" | "similar";
};

export const ROOM_TYPE_OPTIONS = [
  { id: "studio", label: "獨立套房" },
  { id: "1", label: "1 房" },
  { id: "2", label: "2 房" },
  { id: "3", label: "3 房" },
  { id: "4", label: "4 房以上" },
] as const;

export type RentalExtra = "subsidy" | "tax" | "household";

export type RentalMatchCriteria = {
  cities: string[];
  districts: string[];
  /** "4" 代表 4 房以上。空陣列＝不限 */
  rooms: string[];
  /** "1" 剛好 1 衛；"2" 代表 2 衛以上 */
  bathrooms: string[];
  /** "yes" 要車位；"no" 不要；"any" 或不選＝不限 */
  parking: string[];
  priceKeys: string[];
  /** 勾了的項目都要符合 */
  extras: RentalExtra[];
};

export const RENT_PRICE_OPTIONS = [
  { value: "0-10000", label: "1 萬以下", min: 0, max: 10000 },
  { value: "10000-20000", label: "1 - 2 萬", min: 10000, max: 20000 },
  { value: "20000-30000", label: "2 - 3 萬", min: 20000, max: 30000 },
  { value: "30000-50000", label: "3 - 5 萬", min: 30000, max: 50000 },
  { value: "50000-100000", label: "5 - 10 萬", min: 50000, max: 100000 },
  { value: "100000-", label: "10 萬以上", min: 100000, max: Number.POSITIVE_INFINITY },
] as const;

export const EXTRA_OPTIONS: { id: RentalExtra; label: string }[] = [
  { id: "subsidy", label: "租補" },
  { id: "tax", label: "報稅" },
  { id: "household", label: "入籍" },
];

export const VIEWING_SLOTS = [
  { id: "morning", label: "上午 9:00–12:00" },
  { id: "afternoon", label: "下午 13:00–17:00" },
  { id: "evening", label: "晚上 18:00–21:00" },
] as const;

export const MATCH_PAGE_SIZE = 3;
/** 客人對話一次列出的配對物件上限 */
export const MATCH_LIST_LIMIT = 10;

export function emptyCriteria(): RentalMatchCriteria {
  return {
    cities: [],
    districts: [],
    rooms: [],
    bathrooms: [],
    parking: [],
    priceKeys: [],
    extras: [],
  };
}

function roomKeyFromListing(listing: Pick<RentalMatchListing, "rooms" | "houseCondition" | "propertyType">) {
  const condition = listing.houseCondition || listing.propertyType;
  if (condition === "STUDIO") return "studio";
  // 分租套房沒有對應的條件鍵，只鎖縣市／行政區與預算
  if (condition === "SUITE") return null;
  if (listing.rooms >= 4) return "4";
  if (listing.rooms >= 1 && listing.rooms <= 3) return String(listing.rooms);
  return null;
}

/** 從單一物件抽出找房條件（尚未放寬）。 */
export function criteriaFromListing(
  listing: Pick<RentalMatchListing, "city" | "district" | "rooms" | "houseCondition" | "propertyType">,
): RentalMatchCriteria {
  const room = roomKeyFromListing(listing);
  return {
    ...emptyCriteria(),
    cities: listing.city ? [listing.city] : [],
    districts: listing.district ? [listing.district] : [],
    rooms: room ? [room] : [],
  };
}

/** 以該間為基準自動放寬：同縣市行政區／同房型，租金約 ±20%。 */
export function widenCriteriaFromListing(
  listing: Pick<
    RentalMatchListing,
    "city" | "district" | "price" | "rooms" | "houseCondition" | "propertyType"
  >,
): { criteria: RentalMatchCriteria; priceMin: number; priceMax: number } {
  const price = Number.isFinite(listing.price) ? Math.max(0, listing.price) : 0;
  const priceMin = Math.max(0, Math.round(price * 0.8));
  const priceMax = Math.max(priceMin, Math.round(price * 1.2));
  return {
    criteria: criteriaFromListing(listing),
    priceMin,
    priceMax,
  };
}

function hasParking(listing: RentalMatchListing) {
  return Boolean(listing.areaParkingSpace && listing.areaParkingSpace > 0);
}

function priceInBand(price: number, key: string) {
  const band = RENT_PRICE_OPTIONS.find((option) => option.value === key);
  if (!band) return false;
  return price >= band.min && price <= band.max;
}

export function listingMatchesCriteria(listing: RentalMatchListing, criteria: RentalMatchCriteria) {
  if (criteria.cities.length && !criteria.cities.includes(listing.city)) return false;
  if (criteria.districts.length && !criteria.districts.includes(listing.district)) return false;
  if (criteria.rooms.length) {
    const condition = listing.houseCondition || listing.propertyType;
    const suite = condition === "STUDIO" || condition === "SUITE";
    const ok = criteria.rooms.some((value) => {
      if (value === "studio") return condition === "STUDIO";
      const rooms = Number.parseInt(value, 10);
      if (!Number.isFinite(rooms) || suite) return false;
      return rooms === 4 ? listing.rooms >= 4 : listing.rooms === rooms;
    });
    if (!ok) return false;
  }
  if (criteria.bathrooms.length) {
    const ok = criteria.bathrooms.some((value) =>
      value === "1" ? listing.bathrooms === 1 : value === "2" ? listing.bathrooms >= 2 : false,
    );
    if (!ok) return false;
  }
  const parkingAny =
    !criteria.parking.length ||
    criteria.parking.includes("any") ||
    (criteria.parking.includes("yes") && criteria.parking.includes("no"));
  if (!parkingAny) {
    const wantParking = criteria.parking.includes("yes");
    const skipParking = criteria.parking.includes("no");
    if (wantParking && !hasParking(listing)) return false;
    if (skipParking && hasParking(listing)) return false;
  }
  if (criteria.priceKeys.length && !criteria.priceKeys.some((key) => priceInBand(listing.price, key))) {
    return false;
  }
  if (criteria.extras.includes("subsidy") && listing.rentSubsidy !== true) return false;
  if (criteria.extras.includes("tax") && listing.taxDeductible !== true) return false;
  if (criteria.extras.includes("household") && listing.canRegisterAddress !== true) return false;
  return true;
}

export function matchRentals(listings: RentalMatchListing[], criteria: RentalMatchCriteria) {
  const relaxed: string[] = [];
  let current = criteria;
  let items = listings.filter((listing) => listingMatchesCriteria(listing, current));

  if (items.length === 0 && current.extras.length) {
    current = { ...current, extras: [] };
    relaxed.push("補助／報稅／戶籍");
    items = listings.filter((listing) => listingMatchesCriteria(listing, current));
  }
  if (items.length === 0 && current.bathrooms.length) {
    current = { ...current, bathrooms: [] };
    relaxed.push("衛浴");
    items = listings.filter((listing) => listingMatchesCriteria(listing, current));
  }
  if (items.length === 0 && current.parking.length) {
    current = { ...current, parking: [] };
    relaxed.push("車位");
    items = listings.filter((listing) => listingMatchesCriteria(listing, current));
  }

  return { items, relaxed };
}

/**
 * 主配對以外的「類似／符合條件」物件：同縣市為主，略放寬行政區／房型等，排除已在主列表者。
 */
export function similarRentals(
  listings: RentalMatchListing[],
  criteria: RentalMatchCriteria,
  excludeIds: Iterable<string>,
  limit = 8,
): { items: RentalMatchListing[]; notes: string[] } {
  const exclude = new Set(excludeIds);
  const pool = listings.filter((listing) => !exclude.has(listing.id));
  const notes: string[] = [];

  const tryMatch = (soft: RentalMatchCriteria, note: string) => {
    const items = pool.filter((listing) => listingMatchesCriteria(listing, soft));
    if (!items.length) return null;
    notes.push(note);
    return items;
  };

  let items =
    tryMatch(
      {
        ...criteria,
        districts: [],
        bathrooms: [],
        parking: [],
        extras: [],
      },
      "同條件相近（已略放寬行政區／衛浴／車位等）",
    ) ||
    tryMatch(
      {
        ...emptyCriteria(),
        cities: criteria.cities,
        priceKeys: criteria.priceKeys,
        rooms: criteria.rooms,
      },
      "同縣市＋預算／房型相近",
    ) ||
    tryMatch(
      {
        ...emptyCriteria(),
        cities: criteria.cities,
        priceKeys: criteria.priceKeys,
      },
      "同縣市＋預算相近",
    ) ||
    tryMatch(
      {
        ...emptyCriteria(),
        cities: criteria.cities,
      },
      "同縣市其他物件",
    ) ||
    [];

  return { items: items.slice(0, limit), notes };
}

/** 以客人問的那間為中心排類似物件：同縣市為前提，同區、同房型、租金接近者優先。 */
export function rankSimilarToListing(
  listings: RentalMatchListing[],
  focus: RentalMatchListing,
  excludeIds: Iterable<string>,
  limit = 6,
): RentalMatchListing[] {
  const exclude = new Set(excludeIds);
  exclude.add(focus.id);
  const focusRoom = roomKeyFromListing(focus);
  const scored = listings
    .filter((listing) => !exclude.has(listing.id) && listing.city === focus.city)
    .map((listing) => {
      let score = 0;
      if (listing.district === focus.district) score += 3;
      if (focusRoom && roomKeyFromListing(listing) === focusRoom) score += 2;
      const ratio = focus.price > 0 ? listing.price / focus.price : 1;
      if (ratio >= 0.8 && ratio <= 1.2) score += 3;
      else if (ratio >= 0.65 && ratio <= 1.35) score += 1;
      return { listing, score, gap: Math.abs(listing.price - focus.price) };
    })
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score || a.gap - b.gap);
  return scored.slice(0, limit).map((row) => row.listing);
}

function labelsOf(ids: string[], options: readonly { value?: string; id?: string; label: string }[], empty: string) {
  if (!ids.length) return empty;
  return ids
    .map((id) => options.find((option) => option.value === id || option.id === id)?.label ?? id)
    .join("、");
}

export function criteriaSummary(criteria: RentalMatchCriteria) {
  const rooms = labelsOf(criteria.rooms, ROOM_TYPE_OPTIONS, "房型不限");
  const baths = labelsOf(
    criteria.bathrooms,
    [
      { id: "1", label: "1 衛" },
      { id: "2", label: "2 衛以上" },
    ],
    "衛浴不限",
  );
  const parking =
    !criteria.parking.length ||
    criteria.parking.includes("any") ||
    (criteria.parking.includes("yes") && criteria.parking.includes("no"))
      ? "車位不限"
      : labelsOf(
          criteria.parking,
          [
            { id: "yes", label: "要車位" },
            { id: "no", label: "不要車位" },
            { id: "any", label: "不限" },
          ],
          "車位不限",
        );
  const extras = labelsOf(criteria.extras, EXTRA_OPTIONS, "補助／報稅／戶籍不限");
  return [
    criteria.cities.join("、") || "縣市不限",
    criteria.districts.join("、") || "行政區不限",
    rooms,
    baths,
    parking,
    labelsOf(criteria.priceKeys, RENT_PRICE_OPTIONS, "月租不限"),
    extras,
  ].join(" · ");
}

export function formatViewingWhen(date: string, slotId: string) {
  const slot = VIEWING_SLOTS.find((item) => item.id === slotId);
  if (!date || !slot) return "";
  const [year, month, day] = date.split("-");
  return `${year}/${month}/${day} ${slot.label}`;
}

/** date: YYYY-MM-DD；startHm: HH:mm（24h） */
export function formatViewingRange(date: string, startHm: string) {
  if (!date || !startHm) return "";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return "";
  return `${year}/${month}/${day} ${startHm}`;
}

/** date: YYYY-MM-DD → 2026/11/03 */
export function formatDateYmd(date: string) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return "";
  return `${year}/${month}/${day}`;
}

export const VIEWING_TIMELINE = {
  startMinutes: 9 * 60,
  endMinutes: 21 * 60,
  stepMinutes: 15,
} as const;

export function viewingTimelineSlots() {
  const slots: string[] = [];
  for (let m = VIEWING_TIMELINE.startMinutes; m <= VIEWING_TIMELINE.endMinutes; m += VIEWING_TIMELINE.stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

export function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}
