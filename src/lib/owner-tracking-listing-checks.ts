/** 591 連結檢查快取（獨立雲端 key，不寫進案件 blob） */

export type Listing591Status = "live" | "removed" | "unknown" | "error";

export type Listing591CheckEntry = {
  url: string;
  status: Listing591Status;
  checkedAt: string;
  httpStatus?: number;
};

export type OwnerTrackingListingChecksStore = {
  byCaseId: Record<string, Listing591CheckEntry>;
};

export const emptyOwnerTrackingListingChecksStore: OwnerTrackingListingChecksStore = {
  byCaseId: {},
};

export const OWNER_TRACKING_LISTING_CHECKS_STORAGE_KEY =
  "house-platform:owner-tracking-listing-checks:v1";

export function loadOwnerTrackingListingChecksLocal(): OwnerTrackingListingChecksStore {
  if (typeof window === "undefined") return emptyOwnerTrackingListingChecksStore;
  try {
    const raw = window.localStorage.getItem(OWNER_TRACKING_LISTING_CHECKS_STORAGE_KEY);
    if (!raw) return emptyOwnerTrackingListingChecksStore;
    return normalizeOwnerTrackingListingChecksStore(JSON.parse(raw));
  } catch {
    return emptyOwnerTrackingListingChecksStore;
  }
}

export function persistOwnerTrackingListingChecksLocal(store: OwnerTrackingListingChecksStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      OWNER_TRACKING_LISTING_CHECKS_STORAGE_KEY,
      JSON.stringify(normalizeOwnerTrackingListingChecksStore(store)),
    );
  } catch {
    /* quota / private mode */
  }
}

export const LISTING_591_STALE_MS = 24 * 60 * 60 * 1000;

export function normalize591ListingUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  try {
    const href = t.startsWith("http") ? t : `https://${t}`;
    const u = new URL(href);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function is591ListingUrl(raw: string | null | undefined): boolean {
  const normalized = normalize591ListingUrl(raw);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host.includes("591.com.tw");
  } catch {
    return false;
  }
}

const VALID_STATUSES = new Set<Listing591Status>(["live", "removed", "unknown", "error"]);

function normalizeEntry(raw: unknown): Listing591CheckEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = String(o.status ?? "");
  if (!VALID_STATUSES.has(status as Listing591Status)) return null;
  const url = String(o.url ?? "").trim();
  const checkedAt = String(o.checkedAt ?? "");
  if (!url || !checkedAt) return null;
  const httpStatus =
    typeof o.httpStatus === "number" && Number.isFinite(o.httpStatus) ? o.httpStatus : undefined;
  return { url, status: status as Listing591Status, checkedAt, httpStatus };
}

export function normalizeOwnerTrackingListingChecksStore(
  raw: unknown,
): OwnerTrackingListingChecksStore {
  if (!raw || typeof raw !== "object") return emptyOwnerTrackingListingChecksStore;
  const byCaseId: Record<string, Listing591CheckEntry> = {};
  const map = (raw as { byCaseId?: unknown }).byCaseId;
  if (map && typeof map === "object") {
    for (const [caseId, entry] of Object.entries(map as Record<string, unknown>)) {
      const normalized = normalizeEntry(entry);
      if (normalized) byCaseId[caseId] = normalized;
    }
  }
  return { byCaseId };
}

export function mergeListing591CheckResults(
  store: OwnerTrackingListingChecksStore,
  results: Record<string, Listing591CheckEntry>,
): OwnerTrackingListingChecksStore {
  return {
    byCaseId: { ...store.byCaseId, ...results },
  };
}

export type Listing591ListCategory = "not591" | "unchecked" | "live" | "removed";

export function resolveListing591ListCategory(
  listingUrl: string,
  entry: Listing591CheckEntry | undefined,
  nowMs = Date.now(),
): Listing591ListCategory {
  if (!is591ListingUrl(listingUrl)) return "not591";
  const normalized = normalize591ListingUrl(listingUrl);
  if (!normalized || !entry || entry.url !== normalized) return "unchecked";
  if (entry.status === "live") return "live";
  if (entry.status === "removed") return "removed";
  void nowMs;
  return "unchecked";
}

export function isListing591CheckStale(
  listingUrl: string,
  entry: Listing591CheckEntry | undefined,
  nowMs = Date.now(),
): boolean {
  if (!is591ListingUrl(listingUrl)) return false;
  const normalized = normalize591ListingUrl(listingUrl);
  if (!normalized) return false;
  if (!entry || entry.url !== normalized) return true;
  const checked = Date.parse(entry.checkedAt);
  if (Number.isNaN(checked)) return true;
  return nowMs - checked > LISTING_591_STALE_MS;
}

export type OwnerTrackingListing591Filter = "ALL" | "LIVE" | "REMOVED" | "UNCHECKED";

export function parseOwnerTrackingListing591Filter(raw: string | null | undefined): OwnerTrackingListing591Filter {
  const v = (raw ?? "ALL").toUpperCase();
  if (v === "LIVE" || v === "REMOVED" || v === "UNCHECKED") return v;
  return "ALL";
}

export function matchesListing591Filter(
  category: Listing591ListCategory,
  filter: OwnerTrackingListing591Filter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "LIVE") return category === "live";
  if (filter === "REMOVED") return category === "removed";
  return category === "unchecked";
}
