/** 客人找房條件登記（無配對／關閉 LIFF 後仍保留，供之後新案推播） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import {
  criteriaSummary,
  emptyCriteria,
  type RentalExtra,
  type RentalMatchCriteria,
} from "@/lib/line-rental-assistant";

export type GuestWatchRecord = {
  lineUserId: string;
  displayName: string;
  cities: string[];
  districts: string[];
  rooms: string[];
  bathrooms: string[];
  parking: string[];
  priceKeys: string[];
  extras: RentalExtra[];
  /** 自訂預算下限；null＝未設 */
  priceMin: number | null;
  /** 自訂預算上限；null＝未設 */
  priceMax: number | null;
  petNote: string;
  criteriaText: string;
  /** 是否等待新案通知 */
  active: boolean;
  updatedAt: string;
};

type Store = { watches: GuestWatchRecord[] };

function emptyStore(): Store {
  return { watches: [] };
}

function normalizeCriteriaArrays(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function normalizeWatch(raw: unknown): GuestWatchRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<GuestWatchRecord>;
  if (typeof row.lineUserId !== "string" || !row.lineUserId.trim()) return null;
  const priceMin =
    typeof row.priceMin === "number" && Number.isFinite(row.priceMin) ? row.priceMin : null;
  const priceMax =
    typeof row.priceMax === "number" && Number.isFinite(row.priceMax) ? row.priceMax : null;
  return {
    lineUserId: row.lineUserId.trim(),
    displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
    cities: normalizeCriteriaArrays(row.cities),
    districts: normalizeCriteriaArrays(row.districts),
    rooms: normalizeCriteriaArrays(row.rooms),
    bathrooms: normalizeCriteriaArrays(row.bathrooms),
    parking: normalizeCriteriaArrays(row.parking),
    priceKeys: normalizeCriteriaArrays(row.priceKeys),
    extras: Array.isArray(row.extras) ? (row.extras as RentalExtra[]) : [],
    priceMin,
    priceMax,
    petNote: typeof row.petNote === "string" ? row.petNote : "",
    criteriaText: typeof row.criteriaText === "string" ? row.criteriaText : "",
    active: row.active !== false,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return emptyStore();
  const watches = Array.isArray((payload as Store).watches)
    ? ((payload as Store).watches.map(normalizeWatch).filter(Boolean) as GuestWatchRecord[])
    : [];
  return { watches };
}

async function readStore(): Promise<Store> {
  return normalizeStore(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchCriteria));
}

async function writeStore(store: Store) {
  store.watches = store.watches
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 500);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestWatchCriteria, store);
}

export function watchRecordToCriteria(watch: GuestWatchRecord): RentalMatchCriteria {
  return {
    cities: watch.cities,
    districts: watch.districts,
    rooms: watch.rooms,
    bathrooms: watch.bathrooms,
    parking: watch.parking,
    priceKeys: watch.priceKeys,
    extras: watch.extras,
  };
}

/** 以 lineUserId 覆蓋寫入最新條件（同一人只保留一筆） */
export async function upsertGuestWatchCriteria(input: {
  lineUserId: string;
  displayName?: string;
  criteria: RentalMatchCriteria;
  priceMin?: number | null;
  priceMax?: number | null;
  petNote?: string;
  active?: boolean;
}): Promise<GuestWatchRecord> {
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) {
    throw new Error("缺少 lineUserId");
  }
  const criteria = {
    ...emptyCriteria(),
    ...input.criteria,
    cities: input.criteria.cities ?? [],
    districts: input.criteria.districts ?? [],
    rooms: input.criteria.rooms ?? [],
    bathrooms: input.criteria.bathrooms ?? [],
    parking: input.criteria.parking ?? [],
    priceKeys: input.criteria.priceKeys ?? [],
    extras: input.criteria.extras ?? [],
  };
  const store = await readStore();
  const record: GuestWatchRecord = {
    lineUserId,
    displayName: input.displayName?.trim() || "LINE 客人",
    cities: criteria.cities,
    districts: criteria.districts,
    rooms: criteria.rooms,
    bathrooms: criteria.bathrooms,
    parking: criteria.parking,
    priceKeys: criteria.priceKeys,
    extras: criteria.extras,
    priceMin:
      typeof input.priceMin === "number" && Number.isFinite(input.priceMin)
        ? input.priceMin
        : null,
    priceMax:
      typeof input.priceMax === "number" && Number.isFinite(input.priceMax)
        ? input.priceMax
        : null,
    petNote: input.petNote?.trim() || "",
    criteriaText: criteriaSummary(criteria),
    active: input.active !== false,
    updatedAt: new Date().toISOString(),
  };
  store.watches = [record, ...store.watches.filter((row) => row.lineUserId !== lineUserId)];
  await writeStore(store);
  return record;
}

export async function getGuestWatchByUserId(
  lineUserId: string,
): Promise<GuestWatchRecord | null> {
  const id = lineUserId.trim();
  if (!id) return null;
  const store = await readStore();
  return store.watches.find((row) => row.lineUserId === id) ?? null;
}

export async function listActiveGuestWatches(): Promise<GuestWatchRecord[]> {
  const store = await readStore();
  return store.watches
    .filter((row) => row.active)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function setGuestWatchActive(lineUserId: string, active: boolean) {
  const id = lineUserId.trim();
  if (!id) return null;
  const store = await readStore();
  const index = store.watches.findIndex((row) => row.lineUserId === id);
  if (index < 0) return null;
  store.watches[index] = {
    ...store.watches[index],
    active,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.watches[index];
}
