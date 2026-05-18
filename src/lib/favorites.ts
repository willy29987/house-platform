const FAVORITE_KEY = "favorite_listing_ids";
const FAVORITE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

type FavoriteEntry = {
  id: string;
  savedAt: number;
};

function isFavoriteEntry(value: unknown): value is FavoriteEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as FavoriteEntry).id === "string" &&
    "savedAt" in value &&
    typeof (value as FavoriteEntry).savedAt === "number"
  );
}

function parseStoredFavorites(raw: string): FavoriteEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const now = Date.now();
    const entries: FavoriteEntry[] = [];

    for (const item of parsed) {
      if (typeof item === "string") {
        entries.push({ id: item, savedAt: now });
        continue;
      }
      if (isFavoriteEntry(item)) {
        entries.push(item);
      }
    }

    return entries.filter((entry) => now - entry.savedAt < FAVORITE_TTL_MS);
  } catch {
    return [];
  }
}

function writeFavorites(entries: FavoriteEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FAVORITE_KEY, JSON.stringify(entries));
}

function loadActiveEntries(): FavoriteEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(FAVORITE_KEY);
  if (!raw) {
    return [];
  }
  const active = parseStoredFavorites(raw);
  writeFavorites(active);
  return active;
}

export function readFavoriteIds(): string[] {
  return loadActiveEntries().map((entry) => entry.id);
}

export function toggleFavoriteId(listingId: string): string[] {
  const now = Date.now();
  const entries = loadActiveEntries();

  const next = entries.some((entry) => entry.id === listingId)
    ? entries.filter((entry) => entry.id !== listingId)
    : [...entries.filter((entry) => entry.id !== listingId), { id: listingId, savedAt: now }];

  writeFavorites(next);
  return next.map((entry) => entry.id);
}
