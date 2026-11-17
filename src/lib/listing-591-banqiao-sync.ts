import "server-only";

import { normalizeItemList } from "@/lib/furniture-appliance-value";
import {
  import591ListingFromUrl,
  type Listing591ImportDraft,
} from "@/lib/listing-591-import";
import { toListingDescription, parseListingInternalMeta } from "@/lib/listing-internal-meta";
import {
  addPublishedListingToViewableOwnerCase,
  isAutoScrapedOwnerTrackingNote,
} from "@/lib/listing-to-owner-tracking";
import type { ListingInput } from "@/lib/listing-validation";
import { extract591ListingId } from "@/lib/listing-591-id";
import {
  formatOwnerPersonName,
  is591TransferPhone,
  isRealOwnerPhone,
  normalizeOwnerContactPhone,
} from "@/lib/house-fields";
import { check591ListingUrl } from "@/lib/listing-591-check";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import {
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { prisma } from "@/lib/prisma";

/** 591 自抓固定負責人；不吃會變成 system 的錯誤 env */
export const BANQIAO_SYNC_ASSIGNEE = "R001";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** 板橋／中和（積穗～中和站）／土城／新莊／三重（至三重國小）／萬華（至西門町） */
type SectionSpec = {
  regionId: number;
  sectionId: number;
  name: string;
  mode: "all" | "fringe";
  /** 屋主套房（獨立／分租）租金；沒設就不抓套房 */
  suiteRent?: { min: number; max: number };
  /** 公寓整層住家租金；沒設就不抓整層 */
  wholeAptRent?: { min: number; max: number };
};

const SECTION_SPECS: readonly SectionSpec[] = [
  {
    regionId: 3,
    sectionId: 26,
    name: "板橋區",
    mode: "all",
    suiteRent: { min: 10000, max: 20000 },
    wholeAptRent: { min: 15000, max: 45000 },
  },
  {
    regionId: 3,
    sectionId: 38,
    name: "中和區",
    mode: "fringe",
    suiteRent: { min: 10000, max: 20000 },
    wholeAptRent: { min: 15000, max: 45000 },
  },
  {
    regionId: 3,
    sectionId: 39,
    name: "土城區",
    mode: "fringe",
    suiteRent: { min: 10000, max: 20000 },
    wholeAptRent: { min: 15000, max: 45000 },
  },
  {
    regionId: 3,
    sectionId: 44,
    name: "新莊區",
    mode: "fringe",
    suiteRent: { min: 13000, max: 40000 },
    wholeAptRent: { min: 15000, max: 45000 },
  },
  {
    regionId: 3,
    sectionId: 43,
    name: "三重區",
    mode: "fringe",
    wholeAptRent: { min: 15000, max: 45000 },
  },
  {
    regionId: 1,
    sectionId: 6,
    name: "萬華區",
    mode: "fringe",
    wholeAptRent: { min: 15000, max: 50000 },
  },
] as const;

const SUITE_KIND_SPECS = [
  { kind: 2, label: "獨立套房" },
  { kind: 3, label: "分租套房" },
] as const;

/** 591 kind=1 整層住家；shape=1 公寓 */
const WHOLE_APARTMENT_KIND = 1;
const APARTMENT_SHAPE = 1;

const PAGE_SIZE = 30;
/** 單次 cron 最多打詳情筆數（控時間／用量） */
const MAX_DETAIL_PER_RUN = 50;
const LIST_CONCURRENCY = 2;
const DETAIL_CONCURRENCY = 3;

/** 中和：積穗／員山，並延伸至中和站（景平／連城／景安一帶） */
const ZHONGHE_ALLOW =
  /積穗|員山|新生街|中和路|中和站|景平路|連城路|景安|中安|宜安|南山路|圓通路|華新街|民樂路|莊敬路|勝利路|永和路|景新街|保健路/;
const TUCHENG_ALLOW = /亞東|國慶/;
/**
 * 新莊服務範圍（路名／地標近似）：
 * 西至輔大再往西約 500 公尺、北至中原路、東至先嗇宮；排除迴龍／丹鳳等更西側。
 */
const XINZHUANG_ALLOW =
  /輔大|輔仁|先嗇宮|頭前|中原路|建國一|中山路|新莊路|化成路|復興路|中正路|中誠|中平路|中和街|昌平|昌隆|思源路|新泰路|民安|公園路|瓊林|西盛|富國路|重新路/;
const XINZHUANG_DENY = /迴龍|萬壽|景德|丹鳳|龍華|林口|泰山|五股/;
/** 輔大中正路 510；再往西約 500m 後視為超出（迴龍側門牌偏大） */
const XINZHUANG_ZHONGZHENG_WEST_MAX = 620;

/**
 * 三重：最遠到三重國小站（含菜寮／台北橋／三重站一帶）；
 * 排除更北的徐匯中學／三和國中／蘆洲側。
 */
const SANCHONG_ALLOW =
  /三重國小|菜寮|台北橋|三重站|捷運三重|正義|大同[南北]路|重新路|福德|集美|重陽|大智|安和|忠孝路|文化[南北]路|六張|光明|信義街|錦通|貴陽|電信|三民|明德|仁愛|長興|雙園|三和路[二三]段|成功路/;
const SANCHONG_DENY = /徐匯|三和國中|蘆洲|五股|碧華|五華|溪尾|永安北|後竹圍|三和路四段|三和路五段/;

/**
 * 萬華：最遠到西門町（含龍山寺～西門）；
 * 排除更南的東園／青年／華江深區。
 */
const WANHUA_ALLOW =
  /西門|西門町|龍山寺|漢中|昆明|西寧|成都|康定|長沙街|衡陽|武昌|峨眉|寶慶|漢口|洛陽|內江|桂林路|廣州街|和平西路三段|艋舺|西昌|華西|大理街|雅江|中華路/;
const WANHUA_DENY = /東園|青年路|華江|西藏路|寶興|德昌|雙園|萬大路|環河南路|民和街|長順街/;

export type Banqiao591ListItem = {
  id: string;
  kind: number;
  kindName: string;
  title: string;
  price: number;
  address: string;
  roleName: string;
  regionId: number;
  sectionId: number;
  surroundingDesc: string;
  /** 列表是否已帶 shape=公寓；整層案詳情仍會再確認 */
  requireApartment: boolean;
  url: string;
};

export type Banqiao591SyncSummary = {
  listed: number;
  matchedArea: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
  processedIds: string[];
  purgedListings: number;
  purgedCases: number;
  namesFixed: number;
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function parsePrice(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function rentUrl(id: string): string {
  return `https://rent.591.com.tw/rent-detail-${id}.html`;
}

export function matchesXinzhuangServiceArea(address: string): boolean {
  const a = address.replace(/\s+/g, "");
  if (XINZHUANG_DENY.test(a)) return false;
  const zhongzheng = a.match(/中正路(\d+)/);
  if (zhongzheng) {
    const n = Number(zhongzheng[1]);
    if (Number.isFinite(n) && n > XINZHUANG_ZHONGZHENG_WEST_MAX) return false;
  }
  return XINZHUANG_ALLOW.test(a);
}

export function matchesSanchongServiceArea(addressOrBlob: string): boolean {
  const a = addressOrBlob.replace(/\s+/g, "");
  if (SANCHONG_DENY.test(a) && !/三重國小|菜寮|台北橋/.test(a)) return false;
  return SANCHONG_ALLOW.test(a);
}

export function matchesWanhuaServiceArea(addressOrBlob: string): boolean {
  const a = addressOrBlob.replace(/\s+/g, "");
  if (WANHUA_DENY.test(a) && !/西門|西門町|龍山寺/.test(a)) return false;
  return WANHUA_ALLOW.test(a);
}

export function matchesBanqiaoServiceArea(
  address: string,
  sectionId: number,
  extra: { title?: string; surroundingDesc?: string } = {},
): boolean {
  const a = address.replace(/\s+/g, "");
  const blob = `${a}${extra.title ?? ""}${extra.surroundingDesc ?? ""}`.replace(/\s+/g, "");
  if (sectionId === 26) return true;
  if (sectionId === 38) return ZHONGHE_ALLOW.test(blob);
  if (sectionId === 39) return TUCHENG_ALLOW.test(blob);
  if (sectionId === 44) return matchesXinzhuangServiceArea(a);
  if (sectionId === 43) return matchesSanchongServiceArea(blob);
  if (sectionId === 6) return matchesWanhuaServiceArea(blob);
  return false;
}

async function readListPage(opts: {
  regionId: number;
  sectionId: number;
  kind: number;
  shape?: number;
  firstRow: number;
  rentMin: number;
  rentMax: number;
  requireApartment: boolean;
}): Promise<{ total: number; items: Banqiao591ListItem[] }> {
  const shapeQs = opts.shape ? `&shape=${opts.shape}` : "";
  const url =
    `https://bff-house.591.com.tw/v3/web/rent/list` +
    `?regionid=${opts.regionId}&sectionid=${opts.sectionId}&kind=${opts.kind}` +
    shapeQs +
    `&rentprice=${opts.rentMin},${opts.rentMax}&role=1&type=1&firstRow=${opts.firstRow}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
      device: "pc",
      deviceid: "house-platform-banqiao-sync",
      Referer: "https://rent.591.com.tw/",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { total: 0, items: [] };
  const json = (await res.json()) as {
    status?: number;
    data?: { total?: string | number; items?: Record<string, unknown>[] };
  };
  if (json.status !== 1) return { total: 0, items: [] };
  const total = Number(json.data?.total ?? 0) || 0;
  const items: Banqiao591ListItem[] = [];
  for (const raw of json.data?.items ?? []) {
    const id = text(raw.id);
    if (!/^\d+$/.test(id)) continue;
    const price = parsePrice(raw.price);
    if (price < opts.rentMin || price > opts.rentMax) continue;
    const roleName = text(raw.role_name);
    if (roleName && !roleName.includes("屋主")) continue;
    const surrounding = raw.surrounding;
    const surroundingDesc =
      surrounding && typeof surrounding === "object" && !Array.isArray(surrounding)
        ? text((surrounding as Record<string, unknown>).desc)
        : "";
    items.push({
      id,
      kind: Number(raw.kind) || opts.kind,
      kindName: text(raw.kind_name),
      title: text(raw.title),
      price,
      address: text(raw.address),
      roleName,
      regionId: opts.regionId,
      sectionId: opts.sectionId,
      surroundingDesc,
      requireApartment: opts.requireApartment,
      url: rentUrl(id),
    });
  }
  return { total, items };
}

async function listSectionKind(opts: {
  regionId: number;
  sectionId: number;
  kind: number;
  shape?: number;
  rentMin: number;
  rentMax: number;
  requireApartment: boolean;
}): Promise<Banqiao591ListItem[]> {
  const first = await readListPage({ ...opts, firstRow: 0 });
  const out = [...first.items];
  const total = Math.min(first.total || out.length, 300);
  for (let firstRow = PAGE_SIZE; firstRow < total; firstRow += PAGE_SIZE) {
    const page = await readListPage({ ...opts, firstRow });
    out.push(...page.items);
    if (page.items.length === 0) break;
  }
  return out;
}

/** 列出服務範圍內、屋主套房＋公寓整層候選（尚未打詳情） */
export async function listBanqiaoSuiteCandidates(): Promise<Banqiao591ListItem[]> {
  const jobs: Array<Promise<Banqiao591ListItem[]>> = [];
  for (const section of SECTION_SPECS) {
    if (section.suiteRent) {
      for (const kind of SUITE_KIND_SPECS) {
        jobs.push(
          listSectionKind({
            regionId: section.regionId,
            sectionId: section.sectionId,
            kind: kind.kind,
            rentMin: section.suiteRent.min,
            rentMax: section.suiteRent.max,
            requireApartment: false,
          }),
        );
      }
    }
    if (section.wholeAptRent) {
      jobs.push(
        listSectionKind({
          regionId: section.regionId,
          sectionId: section.sectionId,
          kind: WHOLE_APARTMENT_KIND,
          shape: APARTMENT_SHAPE,
          rentMin: section.wholeAptRent.min,
          rentMax: section.wholeAptRent.max,
          requireApartment: true,
        }),
      );
    }
  }

  const chunks: Banqiao591ListItem[][] = [];
  for (let i = 0; i < jobs.length; i += LIST_CONCURRENCY) {
    const batch = await Promise.all(jobs.slice(i, i + LIST_CONCURRENCY));
    chunks.push(...batch);
  }

  const byId = new Map<string, Banqiao591ListItem>();
  for (const item of chunks.flat()) {
    if (
      !matchesBanqiaoServiceArea(item.address, item.sectionId, {
        title: item.title,
        surroundingDesc: item.surroundingDesc,
      })
    ) {
      continue;
    }
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function optionalNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && raw.trim() ? n : undefined;
}

function yesNoBool(raw: "" | "yes" | "no"): boolean | undefined {
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return undefined;
}

/** 591 草稿 → 本站 ListingInput（未刊登） */
export function draftToListingInput(draft: Listing591ImportDraft): ListingInput | null {
  const price = Number(draft.price.replace(/[^\d]/g, ""));
  const areaPing = Number(draft.areaPing.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(areaPing) || areaPing <= 0) return null;
  if (!draft.city.trim() || !draft.district.trim() || draft.address.trim().length < 3) return null;
  if (!draft.contactName.trim()) return null;
  const contactPhone = normalizeOwnerContactPhone(draft.contactPhone);
  // 591 轉接號當沒電話可進；其餘若有填仍需至少 8 碼
  if (contactPhone && contactPhone.replace(/\D/g, "").length < 8) return null;
  if (!draft.title.trim() || draft.title.trim().length < 2) return null;

  const propertyType = draft.propertyType || "APARTMENT";
  const houseCondition = draft.houseCondition || "";
  const roomNumber = houseCondition === "SUITE" ? "待確認" : "";

  const furnitureItems = normalizeItemList(draft.furnitureItems);
  const equipmentItems = normalizeItemList(draft.equipmentItems);

  return {
    title: draft.title.trim(),
    description: "",
    features: [],
    city: draft.city.trim(),
    district: draft.district.trim(),
    address: draft.address.trim(),
    price: Math.round(price),
    areaPing,
    areaMain: undefined,
    areaAncillary: undefined,
    areaCommon: undefined,
    areaLand: undefined,
    areaParkingSpace: optionalNumber(draft.areaParkingSpace),
    parkingPrice: undefined,
    parkingSpaceInfo: undefined,
    parkingRent:
      draft.parkingPriceMode === "separate" ? optionalNumber(draft.parkingRent) : undefined,
    parkingType: draft.parkingType || undefined,
    managementFee: draft.managementFeeSet ? optionalNumber(draft.managementFee) : undefined,
    petsAllowed: yesNoBool(draft.petsAllowed),
    taxDeductible: yesNoBool(draft.taxDeductible),
    rentSubsidy: yesNoBool(draft.rentSubsidy),
    canRegisterAddress: yesNoBool(draft.canRegisterAddress),
    viewingMethod: undefined,
    community: draft.community || undefined,
    buildingAge: undefined,
    orientation: undefined,
    decorLevel: undefined,
    usageZoning: undefined,
    hasElevator: undefined,
    legalUsage: undefined,
    parkingIncluded:
      draft.parkingIncluded === "yes" ? true : draft.parkingIncluded === "no" ? false : undefined,
    mrtLine: draft.mrtLine || undefined,
    mrtStation: draft.mrtStation || undefined,
    videoUrl: undefined,
    rooms: Math.max(0, Math.round(Number(draft.rooms) || 0)),
    livingRooms: optionalNumber(draft.livingRooms),
    balconies: optionalNumber(draft.balconies),
    bathrooms: Math.max(0, Math.round(Number(draft.bathrooms) || 0)),
    floor: optionalNumber(draft.floor),
    totalFloors: optionalNumber(draft.totalFloors),
    listingType: "RENT",
    propertyType,
    houseCondition: houseCondition || undefined,
    coverImage: draft.coverImage || draft.images[0] || undefined,
    images: draft.images,
    contactName: draft.contactName.trim(),
    contactPhone,
    ownerIdCardUrl: undefined,
    source591Id: undefined,
    source591Url: draft.source591Url,
    furnitureProvided: furnitureItems.length > 0 ? true : draft.facilitiesKnown ? false : undefined,
    applianceProvided: equipmentItems.length > 0 ? true : draft.facilitiesKnown ? false : undefined,
    furnitureItems,
    equipmentItems,
    shortTermRent: undefined,
    serviceFee: undefined,
    registrationUse: undefined,
    specialMatters: undefined,
    otherFees: draft.otherFees || undefined,
    securityDeposit: draft.securityDeposit || undefined,
    availableFrom: draft.availableFrom || undefined,
    householdsPerFloor: undefined,
    roomNumber: roomNumber || undefined,
    isPublished: false,
  };
}

function syncFingerprint(data: ListingInput): string {
  return JSON.stringify({
    title: data.title,
    price: data.price,
    city: data.city,
    district: data.district,
    address: data.address,
    areaPing: data.areaPing,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    coverImage: data.coverImage ?? "",
    images: data.images ?? [],
    furnitureItems: data.furnitureItems ?? [],
    equipmentItems: data.equipmentItems ?? [],
    parkingType: data.parkingType ?? "",
    managementFee: data.managementFee ?? null,
    community: data.community ?? "",
    floor: data.floor ?? null,
    totalFloors: data.totalFloors ?? null,
    houseCondition: data.houseCondition ?? "",
    mrtLine: data.mrtLine ?? "",
    mrtStation: data.mrtStation ?? "",
    petsAllowed: data.petsAllowed ?? null,
    taxDeductible: data.taxDeductible ?? null,
    rentSubsidy: data.rentSubsidy ?? null,
    canRegisterAddress: data.canRegisterAddress ?? null,
  });
}

function existingFingerprint(row: {
  title: string;
  price: number;
  city: string;
  district: string;
  address: string;
  areaPing: number;
  contactName: string;
  contactPhone: string;
  coverImage: string | null;
  images: string[];
  community: string | null;
  floor: number | null;
  totalFloors: number | null;
  parkingType: string | null;
  managementFee: number | null;
  mrtLine: string | null;
  mrtStation: string | null;
  petsAllowed: boolean | null;
  taxDeductible: boolean | null;
  rentSubsidy: boolean | null;
  canRegisterAddress: boolean | null;
  description: string;
}): string {
  const meta = parseListingInternalMeta(row.description);
  return JSON.stringify({
    title: row.title,
    price: row.price,
    city: row.city,
    district: row.district,
    address: row.address,
    areaPing: row.areaPing,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    coverImage: row.coverImage ?? "",
    images: row.images ?? [],
    furnitureItems: meta.furnitureItems ?? [],
    equipmentItems: meta.equipmentItems ?? [],
    parkingType: row.parkingType ?? "",
    managementFee: row.managementFee ?? null,
    community: row.community ?? "",
    floor: row.floor ?? null,
    totalFloors: row.totalFloors ?? null,
    houseCondition: meta.houseCondition ?? "",
    mrtLine: row.mrtLine ?? "",
    mrtStation: row.mrtStation ?? "",
    petsAllowed: row.petsAllowed ?? null,
    taxDeductible: row.taxDeductible ?? null,
    rentSubsidy: row.rentSubsidy ?? null,
    canRegisterAddress: row.canRegisterAddress ?? null,
  });
}

function listingWriteData(data: ListingInput, source591Id: string, source591Url: string) {
  return {
    title: data.title,
    description: toListingDescription({
      createdByUsername: BANQIAO_SYNC_ASSIGNEE,
      furnitureProvided: data.furnitureProvided ?? null,
      applianceProvided: data.applianceProvided ?? null,
      furnitureItems: normalizeItemList(data.furnitureItems),
      equipmentItems: normalizeItemList(data.equipmentItems),
      shortTermRent: data.shortTermRent ?? null,
      serviceFee: data.serviceFee ?? null,
      registrationUse: data.registrationUse ?? null,
      specialMatters: data.specialMatters ?? null,
      otherFees: data.otherFees ?? null,
      securityDeposit: data.securityDeposit ?? null,
      availableFrom: data.availableFrom ?? null,
      householdsPerFloor: data.householdsPerFloor ?? null,
      roomNumber: data.roomNumber ?? null,
      houseCondition: data.houseCondition || null,
    }),
    features: data.features ?? [],
    city: data.city,
    district: data.district,
    address: data.address,
    price: data.price,
    areaPing: data.areaPing,
    areaMain: data.areaMain ?? null,
    areaAncillary: data.areaAncillary ?? null,
    areaCommon: data.areaCommon ?? null,
    areaLand: data.areaLand ?? null,
    areaParkingSpace: data.areaParkingSpace ?? null,
    parkingPrice: data.parkingPrice ?? null,
    parkingSpaceInfo: data.parkingSpaceInfo ?? null,
    parkingRent: data.parkingRent ?? null,
    parkingType: data.parkingType ?? null,
    managementFee: data.managementFee ?? null,
    petsAllowed: data.petsAllowed ?? null,
    taxDeductible: data.taxDeductible ?? null,
    rentSubsidy: data.rentSubsidy ?? null,
    canRegisterAddress: data.canRegisterAddress ?? null,
    viewingMethod: data.viewingMethod ?? null,
    community: data.community ?? null,
    buildingAge: data.buildingAge ?? null,
    orientation: data.orientation ?? null,
    decorLevel: data.decorLevel ?? null,
    usageZoning: data.usageZoning ?? null,
    hasElevator: data.hasElevator ?? null,
    legalUsage: data.legalUsage ?? null,
    parkingIncluded: data.parkingIncluded ?? null,
    mrtLine: data.mrtLine ?? null,
    mrtStation: data.mrtStation ?? null,
    videoUrl: data.videoUrl ?? null,
    rooms: data.rooms,
    livingRooms: data.livingRooms ?? null,
    balconies: data.balconies ?? null,
    bathrooms: data.bathrooms,
    floor: data.floor ?? null,
    totalFloors: data.totalFloors ?? null,
    listingType: "RENT" as const,
    propertyType: data.propertyType,
    coverImage: data.coverImage ?? null,
    images: data.images ?? [],
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    ownerIdCardUrl: data.ownerIdCardUrl ?? null,
    source591Id,
    source591Url,
  };
}

async function upsertOne(candidate: Banqiao591ListItem): Promise<"created" | "updated" | "unchanged" | "skipped"> {
  const draft = await import591ListingFromUrl(candidate.url);
  const input = draftToListingInput(draft);
  if (!input) return "skipped";
  // 整層任務只要公寓；列表 shape 偶發漏網時在詳情再擋一次
  if (candidate.requireApartment && input.propertyType !== "APARTMENT") return "skipped";
  if (candidate.requireApartment && input.houseCondition && input.houseCondition !== "WHOLE") {
    return "skipped";
  }

  const source591Id = candidate.id;
  const source591Url = candidate.url;
  const existing = await prisma.listing.findUnique({
    where: { source591Id },
  });

  const nextFp = syncFingerprint(input);
  if (existing) {
    const prevFp = existingFingerprint(existing);
    const listingChanged = prevFp !== nextFp;
    if (!listingChanged) return "unchanged";

    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        ...listingWriteData(input, source591Id, source591Url),
        // 已存在者不改刊登狀態（新建才保持未刊登）
      },
    });
    // 僅內容有變才覆寫屋主追蹤並補當天電訪；沒變不碰追蹤日／次數
    try {
      await addPublishedListingToViewableOwnerCase({
        listingId: existing.id,
        data: { ...input, source591Url, source591Id, isPublished: false },
        assignee: BANQIAO_SYNC_ASSIGNEE,
        overwriteExisting: true,
        suppressNotes: true,
      });
    } catch (error) {
      console.error("[591-banqiao-sync] owner tracking update failed", source591Id, error);
    }
    return "updated";
  }

  const created = await prisma.listing.create({
    data: {
      ...listingWriteData(input, source591Id, source591Url),
      isPublished: false,
    },
    select: { id: true },
  });
  try {
    await addPublishedListingToViewableOwnerCase({
      listingId: created.id,
      data: { ...input, source591Url, source591Id, isPublished: false },
      assignee: BANQIAO_SYNC_ASSIGNEE,
      suppressNotes: true,
    });
  } catch (error) {
    console.error("[591-banqiao-sync] owner tracking create failed", source591Id, error);
  }
  return "created";
}

/**
 * 把已知 591 轉接門號（如 0972-528-577）從物件與屋主追蹤清成沒電話。
 */
export async function scrub591TransferPhones(): Promise<{
  listingsCleared: number;
  casesCleared: number;
}> {
  let listingsCleared = 0;
  let casesCleared = 0;

  if (process.env.DATABASE_URL) {
    const listings = await prisma.listing.findMany({
      where: { contactPhone: { not: "" } },
      select: { id: true, contactPhone: true },
    });
    const clearIds = listings
      .filter((row) => is591TransferPhone(row.contactPhone))
      .map((row) => row.id);
    if (clearIds.length > 0) {
      await prisma.listing.updateMany({
        where: { id: { in: clearIds } },
        data: { contactPhone: "" },
      });
      listingsCleared = clearIds.length;
    }
  }

  // 先看原始 payload：normalize 會先把轉接號清成空，若先 normalize 會誤判「沒得清」而不寫回雲端
  const raw = (await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking)) as OwnerTrackingStore | null;
  const store = normalizeOwnerTrackingStore(raw ?? { cases: [], followUps: [] });
  const rawPhones = new Map<string, string>();
  for (const row of raw?.cases ?? []) {
    if (row?.id) rawPhones.set(String(row.id), String(row.phone ?? ""));
  }
  let changed = false;
  const cases = store.cases.map((ownerCase) => {
    const rawPhone = rawPhones.get(ownerCase.id) ?? ownerCase.phone;
    if (!is591TransferPhone(rawPhone) && !is591TransferPhone(ownerCase.phone)) {
      return ownerCase;
    }
    casesCleared += 1;
    changed = true;
    return { ...ownerCase, phone: "" };
  });
  if (changed) {
    await writeAdminCloudPayload(
      ADMIN_CLOUD_DATA_KEYS.ownerTracking,
      { cases, followUps: store.followUps },
      { replace: true },
    );
  }
  return { listingsCleared, casesCleared };
}

/**
 * 清掉自抓自動備註，並把所有 system 負責人／建立者改成 R001。
 * 未刊登 591 對應案件：連案件備註一併清空。
 */
export async function scrubBanqiaoSyncedOwnerTrackingNotes(): Promise<{
  casesFixed: number;
  notesCleared: number;
  systemActorsFixed: number;
}> {
  const listings = await prisma.listing.findMany({
    where: { source591Id: { not: null }, isPublished: false },
    select: { id: true, source591Id: true, source591Url: true },
  });

  const listingIds = new Set(listings.map((row) => row.id));
  const source591Ids = new Set(
    listings.map((row) => (row.source591Id || "").trim()).filter(Boolean),
  );

  const raw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
  const store = normalizeOwnerTrackingStore(
    (raw as OwnerTrackingStore | null) ?? { cases: [], followUps: [] },
  );

  const syncedCaseIds = new Set<string>();
  for (const ownerCase of store.cases) {
    if (ownerCase.linkedListingId && listingIds.has(ownerCase.linkedListingId)) {
      syncedCaseIds.add(ownerCase.id);
      continue;
    }
    const sid = extract591ListingId(ownerCase.listingUrl);
    if (sid && source591Ids.has(sid)) syncedCaseIds.add(ownerCase.id);
  }

  let casesFixed = 0;
  let notesCleared = 0;
  let systemActorsFixed = 0;
  const cases = store.cases.map((ownerCase) => {
    let changed = false;
    let next = ownerCase;
    const assignee = (ownerCase.assignee || "").trim();
    const isSystem = assignee.toLowerCase() === "system";
    if (isSystem || (syncedCaseIds.has(ownerCase.id) && assignee !== BANQIAO_SYNC_ASSIGNEE)) {
      next = { ...next, assignee: BANQIAO_SYNC_ASSIGNEE };
      if (isSystem || assignee !== BANQIAO_SYNC_ASSIGNEE) systemActorsFixed += 1;
      changed = true;
    }
    if (syncedCaseIds.has(ownerCase.id) && ownerCase.caseNote.trim()) {
      next = { ...next, caseNote: "" };
      notesCleared += 1;
      changed = true;
    }
    if (changed) casesFixed += 1;
    return next;
  });

  const followUps = store.followUps.map((row) => {
    let next = row;
    const by = (row.createdBy || "").trim();
    const isSystem = by.toLowerCase() === "system";
    if (isSystem) {
      next = { ...next, createdBy: BANQIAO_SYNC_ASSIGNEE };
      systemActorsFixed += 1;
    } else if (syncedCaseIds.has(row.caseId) && !by) {
      next = { ...next, createdBy: BANQIAO_SYNC_ASSIGNEE };
      systemActorsFixed += 1;
    }
    if (syncedCaseIds.has(row.caseId) && (isAutoScrapedOwnerTrackingNote(row.note) || isSystem)) {
      if (row.note.trim()) notesCleared += 1;
      next = { ...next, note: "" };
    }
    return next;
  });

  await writeAdminCloudPayload(
    ADMIN_CLOUD_DATA_KEYS.ownerTracking,
    { cases, followUps },
    { replace: true },
  );
  return { casesFixed, notesCleared, systemActorsFixed };
}

function isCompanySyncActor(username: string | null | undefined): boolean {
  const value = (username ?? "").trim().toLowerCase();
  return value === "r001" || value === "system";
}

/**
 * 系統抓下來、負責人是 Company 的 591 案：
 * 連結已下架，而且沒有真正電話（轉接算沒有）→ 刪屋主追蹤，廣告一併刪。
 * 有電話的留下，並拿掉姓名前面的「仲介／屋主」。
 */
export async function purgeGoneCompany591WithoutPhone(opts?: {
  maxChecks?: number;
  dryRun?: boolean;
}): Promise<{
  checked: number;
  purgedListings: number;
  purgedCases: number;
  namesFixed: number;
  keptLive: number;
  unknown: number;
}> {
  const maxChecks = Math.min(Math.max(opts?.maxChecks ?? 40, 1), 80);
  const result = {
    checked: 0,
    purgedListings: 0,
    purgedCases: 0,
    namesFixed: 0,
    keptLive: 0,
    unknown: 0,
  };
  if (!process.env.DATABASE_URL) return result;

  const listings = await prisma.listing.findMany({
    where: { source591Id: { not: null } },
    select: {
      id: true,
      source591Id: true,
      source591Url: true,
      contactName: true,
      contactPhone: true,
      description: true,
    },
  });
  const company = listings.filter((row) =>
    isCompanySyncActor(parseListingInternalMeta(row.description).createdByUsername),
  );
  if (company.length === 0) return result;

  const raw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
  const store = normalizeOwnerTrackingStore(
    (raw as OwnerTrackingStore | null) ?? { cases: [], followUps: [] },
  );
  const casesByListingId = new Map<string, typeof store.cases>();
  const casesBy591Id = new Map<string, typeof store.cases>();
  for (const ownerCase of store.cases) {
    if (ownerCase.linkedListingId) {
      const list = casesByListingId.get(ownerCase.linkedListingId) ?? [];
      list.push(ownerCase);
      casesByListingId.set(ownerCase.linkedListingId, list);
    }
    const sid = extract591ListingId(ownerCase.listingUrl);
    if (sid) {
      const list = casesBy591Id.get(sid) ?? [];
      list.push(ownerCase);
      casesBy591Id.set(sid, list);
    }
  }

  const deleteListingIds = new Set<string>();
  const deleteCaseIds = new Set<string>();
  const renameListings: Array<{ id: string; contactName: string }> = [];
  const renameCases = new Map<string, string>();

  const noPhone: typeof company = [];
  for (const row of company) {
    const related = new Map<string, (typeof store.cases)[number]>();
    for (const ownerCase of casesByListingId.get(row.id) ?? []) related.set(ownerCase.id, ownerCase);
    const sid = (row.source591Id || "").trim();
    for (const ownerCase of casesBy591Id.get(sid) ?? []) {
      if (!isCompanySyncActor(ownerCase.assignee) && ownerCase.linkedListingId !== row.id) continue;
      related.set(ownerCase.id, ownerCase);
    }
    const phones = [row.contactPhone, ...Array.from(related.values()).map((ownerCase) => ownerCase.phone)];
    const nextListingName = formatOwnerPersonName(row.contactName);
    if (nextListingName && nextListingName !== row.contactName.trim()) {
      renameListings.push({ id: row.id, contactName: nextListingName });
    }
    for (const ownerCase of related.values()) {
      if (!isCompanySyncActor(ownerCase.assignee)) continue;
      const nextName = formatOwnerPersonName(ownerCase.ownerName);
      if (nextName && nextName !== ownerCase.ownerName.trim()) renameCases.set(ownerCase.id, nextName);
    }
    if (phones.some((phone) => isRealOwnerPhone(phone))) continue;
    noPhone.push(row);
  }

  const queue = noPhone.slice(0, maxChecks);
  let index = 0;
  async function worker() {
    while (index < queue.length) {
      const row = queue[index++];
      if (!row?.source591Id) continue;
      const url = (row.source591Url || "").trim() || rentUrl(row.source591Id);
      const check = await check591ListingUrl(url);
      result.checked += 1;
      if (check.status === "live") {
        result.keptLive += 1;
        continue;
      }
      if (check.status !== "removed") {
        result.unknown += 1;
        continue;
      }
      deleteListingIds.add(row.id);
      const sid = row.source591Id.trim();
      for (const ownerCase of casesByListingId.get(row.id) ?? []) {
        if (isCompanySyncActor(ownerCase.assignee) || ownerCase.linkedListingId === row.id) {
          deleteCaseIds.add(ownerCase.id);
        }
      }
      for (const ownerCase of casesBy591Id.get(sid) ?? []) {
        if (isCompanySyncActor(ownerCase.assignee) || ownerCase.linkedListingId === row.id) {
          deleteCaseIds.add(ownerCase.id);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()));

  result.purgedListings = deleteListingIds.size;
  result.purgedCases = deleteCaseIds.size;
  result.namesFixed = renameListings.length + renameCases.size;
  if (opts?.dryRun) return result;

  for (const row of renameListings) {
    if (deleteListingIds.has(row.id)) continue;
    await prisma.listing.update({ where: { id: row.id }, data: { contactName: row.contactName } });
  }
  if (deleteListingIds.size > 0) {
    await prisma.listing.deleteMany({ where: { id: { in: Array.from(deleteListingIds) } } });
  }

  if (deleteCaseIds.size > 0 || renameCases.size > 0) {
    const nextCases = store.cases
      .filter((ownerCase) => !deleteCaseIds.has(ownerCase.id))
      .map((ownerCase) => {
        const nextName = renameCases.get(ownerCase.id);
        return nextName ? { ...ownerCase, ownerName: nextName } : ownerCase;
      });
    await writeAdminCloudPayload(
      ADMIN_CLOUD_DATA_KEYS.ownerTracking,
      {
        cases: nextCases,
        followUps: store.followUps.filter((row) => !deleteCaseIds.has(row.caseId)),
      },
      { replace: true },
    );
  }

  return result;
}

/**
 * 同步服務範圍屋主套房＋公寓整層住家 → 本站未刊登物件 + 屋主追蹤。
 * 範圍：板橋／中和（至中和站）／土城／新莊／三重（至三重國小）／萬華（至西門町）。
 * 同一 source591Id 不重建；內容有差異才更新。
 * Company 自抓案若 591 連結已消失且沒有真正電話，連廣告一起刪。
 */
export async function runBanqiao591SuiteSync(
  opts: { maxDetails?: number } = {},
): Promise<Banqiao591SyncSummary> {
  const maxDetails = Math.min(Math.max(opts.maxDetails ?? MAX_DETAIL_PER_RUN, 1), 80);
  const summary: Banqiao591SyncSummary = {
    listed: 0,
    matchedArea: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    processedIds: [],
    purgedListings: 0,
    purgedCases: 0,
    namesFixed: 0,
  };

  if (!process.env.DATABASE_URL) {
    summary.errors.push("缺少 DATABASE_URL");
    return summary;
  }

  try {
    await scrub591TransferPhones();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(`scrub transfer phones: ${message.slice(0, 160)}`);
  }

  try {
    await scrubBanqiaoSyncedOwnerTrackingNotes();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(`scrub notes: ${message.slice(0, 160)}`);
  }

  try {
    const purged = await purgeGoneCompany591WithoutPhone();
    summary.purgedListings = purged.purgedListings;
    summary.purgedCases = purged.purgedCases;
    summary.namesFixed = purged.namesFixed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(`purge: ${message.slice(0, 160)}`);
  }

  const candidates = await listBanqiaoSuiteCandidates();
  summary.listed = candidates.length;
  summary.matchedArea = candidates.length;

  const ids = candidates.map((c) => c.id);
  const existingRows = ids.length
    ? await prisma.listing.findMany({
        where: { source591Id: { in: ids } },
        select: { source591Id: true, updatedAt: true },
      })
    : [];
  const existingAt = new Map(
    existingRows
      .filter((r) => r.source591Id)
      .map((r) => [r.source591Id as string, r.updatedAt.getTime()] as const),
  );

  // 新案優先，其次較久未更新者
  const ordered = [...candidates].sort((a, b) => {
    const aEx = existingAt.has(a.id);
    const bEx = existingAt.has(b.id);
    if (aEx !== bEx) return aEx ? 1 : -1;
    return (existingAt.get(a.id) ?? 0) - (existingAt.get(b.id) ?? 0);
  });

  const queue = ordered.slice(0, maxDetails);
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const i = index++;
      const item = queue[i];
      if (!item) continue;
      try {
        const result = await upsertOne(item);
        summary.processedIds.push(item.id);
        if (result === "created") summary.created += 1;
        else if (result === "updated") summary.updated += 1;
        else if (result === "unchanged") summary.unchanged += 1;
        else summary.skipped += 1;
      } catch (error) {
        summary.skipped += 1;
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push(`#${item.id}: ${message.slice(0, 160)}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, queue.length) }, () => worker()),
  );

  return summary;
}
