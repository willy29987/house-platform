/** 租屋 LINE 客服試做：條件可複選，只配對已上架出租物件。 */

export type RentalMatchListing = {
  id: string;
  title: string;
  city: string;
  district: string;
  address: string;
  price: number;
  areaPing: number;
  rooms: number;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  areaParkingSpace: number | null;
  petsAllowed: boolean | null;
  coverImage: string | null;
  images: string[];
  rentSubsidy: boolean | null;
  taxDeductible: boolean | null;
  canRegisterAddress: boolean | null;
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
  rooms: number;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  areaParkingSpace: number | null;
  petsAllowed: boolean | null;
  coverImage: string | null;
  images: string[];
  rentSubsidy: boolean | null;
  taxDeductible: boolean | null;
  canRegisterAddress: boolean | null;
}): RentalMatchListing {
  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    district: listing.district,
    address: listing.address,
    price: listing.price,
    areaPing: listing.areaPing,
    rooms: listing.rooms,
    bathrooms: listing.bathrooms,
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    areaParkingSpace: listing.areaParkingSpace,
    petsAllowed: listing.petsAllowed,
    coverImage: listing.coverImage,
    images: listing.images,
    rentSubsidy: listing.rentSubsidy,
    taxDeductible: listing.taxDeductible,
    canRegisterAddress: listing.canRegisterAddress,
  };
}

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
    const ok = criteria.rooms.some((value) => {
      const rooms = Number.parseInt(value, 10);
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

function labelsOf(ids: string[], options: readonly { value?: string; id?: string; label: string }[], empty: string) {
  if (!ids.length) return empty;
  return ids
    .map((id) => options.find((option) => option.value === id || option.id === id)?.label ?? id)
    .join("、");
}

export function criteriaSummary(criteria: RentalMatchCriteria) {
  const rooms = labelsOf(
    criteria.rooms,
    [
      { id: "1", label: "1 房" },
      { id: "2", label: "2 房" },
      { id: "3", label: "3 房" },
      { id: "4", label: "4 房以上" },
    ],
    "房數不限",
  );
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
