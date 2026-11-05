/** 客人約看個資（以 LINE userId 一筆，之後送出覆蓋） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

export type GuestProfile = {
  lineUserId: string;
  displayName: string;
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  updatedAt: string;
};

type Store = { profiles: GuestProfile[] };

function emptyStore(): Store {
  return { profiles: [] };
}

export function isValidGuestPhone(phone: string) {
  const value = phone.trim();
  return /^09\d{8}$/.test(value) || /^0\d{8,12}$/.test(value);
}

export function isCompleteGuestProfile(profile: Pick<
  GuestProfile,
  "phone" | "occupation" | "nationality" | "moveInDate" | "peopleCount"
>) {
  return (
    isValidGuestPhone(profile.phone) &&
    Boolean(profile.occupation.trim()) &&
    Boolean(profile.nationality.trim()) &&
    Boolean(profile.moveInDate.trim()) &&
    profile.peopleCount >= 1
  );
}

function normalizeProfile(raw: unknown): GuestProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<GuestProfile>;
  if (typeof row.lineUserId !== "string" || !row.lineUserId.trim()) return null;
  const people = Number(row.peopleCount);
  return {
    lineUserId: row.lineUserId.trim(),
    displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
    phone: typeof row.phone === "string" ? row.phone.trim() : "",
    occupation: typeof row.occupation === "string" ? row.occupation.trim() : "",
    nationality: typeof row.nationality === "string" ? row.nationality.trim() : "",
    peopleCount: Number.isFinite(people) && people >= 1 ? Math.min(6, Math.round(people)) : 1,
    petNote: typeof row.petNote === "string" ? row.petNote.trim() : "",
    moveInDate: typeof row.moveInDate === "string" ? row.moveInDate.trim() : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return emptyStore();
  const profiles = Array.isArray((payload as Store).profiles)
    ? ((payload as Store).profiles.map(normalizeProfile).filter(Boolean) as GuestProfile[])
    : [];
  return { profiles };
}

async function readStore(): Promise<Store> {
  return normalizeStore(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestProfile));
}

async function writeStore(store: Store) {
  store.profiles = store.profiles
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 800);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestProfile, store);
}

export async function getGuestProfileByUserId(lineUserId: string): Promise<GuestProfile | null> {
  const id = lineUserId.trim();
  if (!id) return null;
  const store = await readStore();
  return store.profiles.find((row) => row.lineUserId === id) ?? null;
}

/** 以 lineUserId 覆蓋寫入最新個資 */
export async function upsertGuestProfile(input: {
  lineUserId: string;
  displayName?: string;
  phone: string;
  occupation?: string;
  nationality?: string;
  peopleCount?: number;
  petNote?: string;
  moveInDate?: string;
}): Promise<GuestProfile | null> {
  const lineUserId = input.lineUserId.trim();
  const phone = input.phone.trim();
  if (!lineUserId || !isValidGuestPhone(phone)) return null;

  const people = Number(input.peopleCount);
  const record: GuestProfile = {
    lineUserId,
    displayName: input.displayName?.trim() || "LINE 客人",
    phone,
    occupation: input.occupation?.trim() || "",
    nationality: input.nationality?.trim() || "",
    peopleCount: Number.isFinite(people) && people >= 1 ? Math.min(6, Math.round(people)) : 1,
    petNote: input.petNote?.trim() || "",
    moveInDate: input.moveInDate?.trim() || "",
    updatedAt: new Date().toISOString(),
  };

  const store = await readStore();
  store.profiles = [record, ...store.profiles.filter((row) => row.lineUserId !== lineUserId)];
  await writeStore(store);
  return record;
}
