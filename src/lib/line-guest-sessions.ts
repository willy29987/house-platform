/** 客人 LINE 找房對話進度（AdminCloudData） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import type { RentalExtra } from "@/lib/line-rental-assistant";

export type GuestFlowStep =
  | "city"
  | "district"
  | "rooms"
  | "price"
  | "extras"
  | "pet"
  | "awaiting_liff"
  | "people"
  | "occupation"
  | "moveIn"
  | "nationality"
  | "phone"
  | "done";

export type GuestSessionPicked = { id: string; title: string; price: number };

export type GuestSession = {
  id: string;
  lineUserId: string;
  displayName: string;
  step: GuestFlowStep;
  cities: string[];
  districts: string[];
  rooms: string[];
  priceKeys: string[];
  extras: RentalExtra[];
  petNote: string;
  picked: GuestSessionPicked[];
  requestedWhen: string;
  peopleCount: number;
  occupation: string;
  moveInDate: string;
  nationality: string;
  phone: string;
  updatedAt: string;
};

type Store = { sessions: GuestSession[] };

function emptyStore(): Store {
  return { sessions: [] };
}

function normalizeSession(raw: unknown): GuestSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<GuestSession>;
  if (typeof row.id !== "string" || typeof row.lineUserId !== "string") return null;
  return {
    id: row.id,
    lineUserId: row.lineUserId,
    displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
    step: (row.step as GuestFlowStep) || "city",
    cities: Array.isArray(row.cities) ? row.cities.map(String) : [],
    districts: Array.isArray(row.districts) ? row.districts.map(String) : [],
    rooms: Array.isArray(row.rooms) ? row.rooms.map(String) : [],
    priceKeys: Array.isArray(row.priceKeys) ? row.priceKeys.map(String) : [],
    extras: Array.isArray(row.extras) ? (row.extras as RentalExtra[]) : [],
    petNote: typeof row.petNote === "string" ? row.petNote : "",
    picked: Array.isArray(row.picked) ? (row.picked as GuestSessionPicked[]) : [],
    requestedWhen: typeof row.requestedWhen === "string" ? row.requestedWhen : "",
    peopleCount: Number.isFinite(row.peopleCount) ? Number(row.peopleCount) : 1,
    occupation: typeof row.occupation === "string" ? row.occupation : "",
    moveInDate: typeof row.moveInDate === "string" ? row.moveInDate : "",
    nationality: typeof row.nationality === "string" ? row.nationality : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}

async function readStore(): Promise<Store> {
  const payload = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestSessions);
  if (!payload || typeof payload !== "object") return emptyStore();
  const sessions = Array.isArray((payload as Store).sessions)
    ? ((payload as Store).sessions.map(normalizeSession).filter(Boolean) as GuestSession[])
    : [];
  return { sessions };
}

async function writeStore(store: Store) {
  store.sessions = store.sessions.slice(0, 300);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestSessions, store);
}

export async function getGuestSessionByUserId(lineUserId: string): Promise<GuestSession | null> {
  const store = await readStore();
  return store.sessions.find((s) => s.lineUserId === lineUserId && s.step !== "done") ?? null;
}

export async function getGuestSessionById(id: string): Promise<GuestSession | null> {
  const store = await readStore();
  return store.sessions.find((s) => s.id === id) ?? null;
}

export async function createGuestSession(input: {
  lineUserId: string;
  displayName?: string;
}): Promise<GuestSession> {
  const store = await readStore();
  store.sessions = store.sessions.filter(
    (s) => !(s.lineUserId === input.lineUserId && s.step !== "done"),
  );
  const created: GuestSession = {
    id: `gfs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    lineUserId: input.lineUserId,
    displayName: input.displayName?.trim() || "LINE 客人",
    step: "city",
    cities: [],
    districts: [],
    rooms: [],
    priceKeys: [],
    extras: [],
    petNote: "",
    picked: [],
    requestedWhen: "",
    peopleCount: 1,
    occupation: "",
    moveInDate: "",
    nationality: "",
    phone: "",
    updatedAt: new Date().toISOString(),
  };
  store.sessions = [created, ...store.sessions];
  await writeStore(store);
  return created;
}

export async function saveGuestSession(session: GuestSession): Promise<GuestSession> {
  const store = await readStore();
  const next = { ...session, updatedAt: new Date().toISOString() };
  const index = store.sessions.findIndex((s) => s.id === next.id);
  if (index >= 0) store.sessions[index] = next;
  else store.sessions.unshift(next);
  await writeStore(store);
  return next;
}
