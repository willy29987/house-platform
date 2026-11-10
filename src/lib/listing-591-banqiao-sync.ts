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

/** 新北市 */
const REGION_ID = 3;
/** 板橋／中和（積穗）／土城（亞東・國慶） */
const SECTION_SPECS = [
  { sectionId: 26, name: "板橋區", mode: "all" as const },
  { sectionId: 38, name: "中和區", mode: "fringe" as const },
  { sectionId: 39, name: "土城區", mode: "fringe" as const },
];

const KIND_SPECS = [
  { kind: 2, label: "獨立套房" },
  { kind: 3, label: "分租套房" },
] as const;

const RENT_MIN = 10000;
const RENT_MAX = 20000;
const PAGE_SIZE = 30;
/** 單次 cron 最多打詳情筆數（控時間／用量） */
const MAX_DETAIL_PER_RUN = 35;
const LIST_CONCURRENCY = 2;
const DETAIL_CONCURRENCY = 3;

const ZHONGHE_ALLOW = /積穗|員山|新生街/;
const TUCHENG_ALLOW = /亞東|國慶/;

export type Banqiao591ListItem = {
  id: string;
  kind: number;
  kindName: string;
  title: string;
  price: number;
  address: string;
  roleName: string;
  sectionId: number;
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

export function matchesBanqiaoServiceArea(address: string, sectionId: number): boolean {
  const a = address.replace(/\s+/g, "");
  if (sectionId === 26) return true;
  if (sectionId === 38) return ZHONGHE_ALLOW.test(a);
  if (sectionId === 39) return TUCHENG_ALLOW.test(a);
  return false;
}

async function readListPage(opts: {
  sectionId: number;
  kind: number;
  firstRow: number;
}): Promise<{ total: number; items: Banqiao591ListItem[] }> {
  const url =
    `https://bff-house.591.com.tw/v3/web/rent/list` +
    `?regionid=${REGION_ID}&sectionid=${opts.sectionId}&kind=${opts.kind}` +
    `&rentprice=${RENT_MIN},${RENT_MAX}&role=1&type=1&firstRow=${opts.firstRow}`;
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
    if (price < RENT_MIN || price > RENT_MAX) continue;
    const roleName = text(raw.role_name);
    if (roleName && !roleName.includes("屋主")) continue;
    items.push({
      id,
      kind: Number(raw.kind) || opts.kind,
      kindName: text(raw.kind_name),
      title: text(raw.title),
      price,
      address: text(raw.address),
      roleName,
      sectionId: opts.sectionId,
      url: rentUrl(id),
    });
  }
  return { total, items };
}

async function listSectionKind(sectionId: number, kind: number): Promise<Banqiao591ListItem[]> {
  const first = await readListPage({ sectionId, kind, firstRow: 0 });
  const out = [...first.items];
  const total = Math.min(first.total || out.length, 300);
  for (let firstRow = PAGE_SIZE; firstRow < total; firstRow += PAGE_SIZE) {
    const page = await readListPage({ sectionId, kind, firstRow });
    out.push(...page.items);
    if (page.items.length === 0) break;
  }
  return out;
}

/** 列出板橋服務範圍內、屋主套房候選（尚未打詳情） */
export async function listBanqiaoSuiteCandidates(): Promise<Banqiao591ListItem[]> {
  const jobs: Array<Promise<Banqiao591ListItem[]>> = [];
  for (const section of SECTION_SPECS) {
    for (const kind of KIND_SPECS) {
      jobs.push(listSectionKind(section.sectionId, kind.kind));
    }
  }

  const chunks: Banqiao591ListItem[][] = [];
  for (let i = 0; i < jobs.length; i += LIST_CONCURRENCY) {
    const batch = await Promise.all(jobs.slice(i, i + LIST_CONCURRENCY));
    chunks.push(...batch);
  }

  const byId = new Map<string, Banqiao591ListItem>();
  for (const item of chunks.flat()) {
    if (!matchesBanqiaoServiceArea(item.address, item.sectionId)) continue;
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
  if (!draft.contactName.trim() || draft.contactPhone.trim().length < 8) return null;
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
    taxDeductible: undefined,
    rentSubsidy: undefined,
    canRegisterAddress: undefined,
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
    contactPhone: draft.contactPhone.trim(),
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

  const source591Id = candidate.id;
  const source591Url = candidate.url;
  const existing = await prisma.listing.findUnique({
    where: { source591Id },
  });

  const nextFp = syncFingerprint(input);
  if (existing) {
    const prevFp = existingFingerprint(existing);
    if (prevFp === nextFp) return "unchanged";
    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        ...listingWriteData(input, source591Id, source591Url),
        // 已存在者不改刊登狀態（新建才保持未刊登）
      },
    });
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
 * 清掉既有自抓案的自動備註，並把負責人 system → R001。
 * 只動「未刊登 + 有 591 id」對應的屋主追蹤。
 */
export async function scrubBanqiaoSyncedOwnerTrackingNotes(): Promise<{
  casesFixed: number;
  notesCleared: number;
}> {
  const listings = await prisma.listing.findMany({
    where: { source591Id: { not: null }, isPublished: false },
    select: { id: true, source591Id: true, source591Url: true },
  });
  if (listings.length === 0) return { casesFixed: 0, notesCleared: 0 };

  const listingIds = new Set(listings.map((row) => row.id));
  const source591Ids = new Set(
    listings.map((row) => (row.source591Id || "").trim()).filter(Boolean),
  );

  const raw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
  const store = normalizeOwnerTrackingStore(
    (raw as OwnerTrackingStore | null) ?? { cases: [], followUps: [] },
  );

  const matchedCaseIds = new Set<string>();
  for (const ownerCase of store.cases) {
    if (ownerCase.linkedListingId && listingIds.has(ownerCase.linkedListingId)) {
      matchedCaseIds.add(ownerCase.id);
      continue;
    }
    const sid = extract591ListingId(ownerCase.listingUrl);
    if (sid && source591Ids.has(sid)) matchedCaseIds.add(ownerCase.id);
  }
  if (matchedCaseIds.size === 0) return { casesFixed: 0, notesCleared: 0 };

  let casesFixed = 0;
  let notesCleared = 0;
  const cases = store.cases.map((ownerCase) => {
    if (!matchedCaseIds.has(ownerCase.id)) return ownerCase;
    let changed = false;
    let next = ownerCase;
    if ((ownerCase.assignee || "").trim() !== BANQIAO_SYNC_ASSIGNEE) {
      next = { ...next, assignee: BANQIAO_SYNC_ASSIGNEE };
      changed = true;
    }
    if (ownerCase.caseNote.trim()) {
      next = { ...next, caseNote: "" };
      notesCleared += 1;
      changed = true;
    }
    if (changed) casesFixed += 1;
    return next;
  });

  const followUps = store.followUps.map((row) => {
    if (!matchedCaseIds.has(row.caseId)) return row;
    let next = row;
    const by = (row.createdBy || "").trim();
    if (by === "system" || !by) {
      next = { ...next, createdBy: BANQIAO_SYNC_ASSIGNEE };
    }
    if (isAutoScrapedOwnerTrackingNote(row.note) || by === "system") {
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
  return { casesFixed, notesCleared };
}

/**
 * 同步板橋服務範圍屋主套房 → 本站未刊登物件 + 屋主追蹤。
 * 同一 source591Id 不重建；內容有差異才更新。不因 591 消失而自動下架。
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
  };

  if (!process.env.DATABASE_URL) {
    summary.errors.push("缺少 DATABASE_URL");
    return summary;
  }

  try {
    await scrubBanqiaoSyncedOwnerTrackingNotes();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.errors.push(`scrub notes: ${message.slice(0, 160)}`);
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
