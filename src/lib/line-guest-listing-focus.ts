/**
 * 客人最近關注的物件（貼 591 連結／App 分享／截圖對中後寫入），
 * 供條件問句（還在嗎／寵物／租補…）對到同一間。
 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

export type GuestListingFocus = {
  lineUserId: string;
  listingId: string;
  title: string;
  source591Id?: string;
  source591Url?: string;
  updatedAt: string;
};

type Store = { focuses: GuestListingFocus[] };

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return { focuses: [] };
  const focuses = Array.isArray((payload as Store).focuses) ? (payload as Store).focuses : [];
  return {
    focuses: focuses
      .filter(
        (row) =>
          row &&
          typeof row.lineUserId === "string" &&
          typeof row.listingId === "string" &&
          typeof row.updatedAt === "string",
      )
      .slice(0, 500),
  };
}

async function readStore() {
  return normalizeStore(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestListingFocus));
}

async function writeStore(store: Store) {
  store.focuses = store.focuses.slice(0, 500);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineGuestListingFocus, store);
}

export async function rememberGuestListingFocus(input: {
  lineUserId: string | null | undefined;
  listingId: string;
  title?: string;
  source591Id?: string | null;
  source591Url?: string | null;
}) {
  const lineUserId = input.lineUserId?.trim() ?? "";
  const listingId = input.listingId.trim();
  if (!lineUserId || !listingId) return;

  const store = await readStore();
  const next: GuestListingFocus = {
    lineUserId,
    listingId,
    title: (input.title ?? "").trim(),
    source591Id: input.source591Id?.trim() || undefined,
    source591Url: input.source591Url?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  store.focuses = [next, ...store.focuses.filter((row) => row.lineUserId !== lineUserId)];
  await writeStore(store);
}

export async function getGuestListingFocus(
  lineUserId: string | null | undefined,
): Promise<GuestListingFocus | null> {
  const id = lineUserId?.trim() ?? "";
  if (!id) return null;
  const store = await readStore();
  return store.focuses.find((row) => row.lineUserId === id) ?? null;
}
