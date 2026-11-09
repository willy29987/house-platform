/** 用 dHash 把客人傳來的照片對上已上架租屋圖。 */

import { ListingType } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { normalizeItemList } from "@/lib/furniture-appliance-value";
import { parseListingInternalMeta } from "@/lib/listing-internal-meta";
import { getLineChannelAccessToken } from "@/lib/line-messaging";
import {
  loadPublishedRentalMatchListing,
  toRentalMatchListing,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { prisma } from "@/lib/prisma";

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

const DHASH_SIZE = 8;
/** 直接採用的距離；裁切截圖誤配的別間通常在 13 以上 */
const SURE_HAMMING = 8;
/** 稍遠時要比第二名（別間）明顯近才採用 */
const MAX_HAMMING = 10;
const MIN_MARGIN = 3;
const MATCH_BUDGET_MS = 6000;
const FETCH_CONCURRENCY = 6;
/** 直式手機截圖：照片通常在上方、滿版寬，比例 4:3／3:2／16:9 */
const SCREENSHOT_CROP_RATIOS = [0.8, 0.75, 0.667, 0.5625];
const SCREENSHOT_CROP_TOPS = [0, 0.02, 0.04, 0.06, 0.08, 0.1];

type HashCache = {
  /** imageUrl → 16-hex dHash */
  byUrl: Record<string, string>;
  updatedAt: string;
};

function emptyCache(): HashCache {
  return { byUrl: {}, updatedAt: new Date(0).toISOString() };
}

function normalizeCache(payload: unknown): HashCache {
  if (!payload || typeof payload !== "object") return emptyCache();
  const byUrl = (payload as HashCache).byUrl;
  if (!byUrl || typeof byUrl !== "object") return emptyCache();
  const next: Record<string, string> = {};
  for (const [url, hash] of Object.entries(byUrl)) {
    if (typeof url === "string" && typeof hash === "string" && /^[0-9a-f]{16}$/i.test(hash)) {
      next[url] = hash.toLowerCase();
    }
  }
  const updatedAt =
    typeof (payload as HashCache).updatedAt === "string"
      ? (payload as HashCache).updatedAt
      : new Date(0).toISOString();
  return { byUrl: next, updatedAt };
}

function hammingHex(a: string, b: string) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = Number.parseInt(a[i]!, 16) ^ Number.parseInt(b[i]!, 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** 64-bit dHash → 16 hex chars */
export async function computeDHash(buffer: Buffer): Promise<string> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize(DHASH_SIZE + 1, DHASH_SIZE, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== DHASH_SIZE + 1 || info.height !== DHASH_SIZE) {
    throw new Error("unexpected dhash size");
  }

  let bits = BigInt(0);
  for (let y = 0; y < DHASH_SIZE; y += 1) {
    for (let x = 0; x < DHASH_SIZE; x += 1) {
      const left = data[y * (DHASH_SIZE + 1) + x] ?? 0;
      const right = data[y * (DHASH_SIZE + 1) + x + 1] ?? 0;
      bits = (bits << BigInt(1)) | (left < right ? BigInt(1) : BigInt(0));
    }
  }
  return bits.toString(16).padStart(16, "0");
}

/** 整張圖＋（直式截圖時）上方照片區的多種裁切。 */
async function guestImageHashes(buffer: Buffer): Promise<string[]> {
  const sharp = await loadSharp();
  const upright = await sharp(buffer).rotate().toBuffer({ resolveWithObject: true });
  const width = upright.info.width;
  const height = upright.info.height;
  const hashes = new Set<string>([await computeDHash(upright.data)]);
  if (!width || !height || height / width < 1.3) return [...hashes];
  for (const ratio of SCREENSHOT_CROP_RATIOS) {
    const cropHeight = Math.round(width * ratio);
    for (const topRatio of SCREENSHOT_CROP_TOPS) {
      const top = Math.round(height * topRatio);
      if (top + cropHeight > height) continue;
      try {
        const cropped = await sharp(upright.data)
          .extract({ left: 0, top, width, height: cropHeight })
          .toBuffer();
        hashes.add(await computeDHash(cropped));
      } catch {
        /* skip bad crop */
      }
    }
  }
  return [...hashes];
}

async function fetchImageBuffer(url: string, signal?: AbortSignal): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "image/*" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 12_000_000) return null;
    return bytes;
  } catch {
    return null;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

function listingImageUrls(listing: {
  coverImage: string | null;
  images: string[];
}): string[] {
  const urls = [listing.coverImage, ...(listing.images ?? [])]
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url.trim()))
    .map((url) => url.trim());
  return [...new Set(urls)];
}

async function ensureListingHashes(
  cache: HashCache,
  listings: { id: string; coverImage: string | null; images: string[] }[],
  deadline: number,
): Promise<HashCache> {
  const missing = new Set<string>();
  for (const listing of listings) {
    for (const url of listingImageUrls(listing)) {
      if (!cache.byUrl[url]) missing.add(url);
    }
  }
  if (!missing.size) return cache;

  const urls = [...missing];
  await mapPool(urls, FETCH_CONCURRENCY, async (url) => {
    if (Date.now() > deadline) return;
    const buffer = await fetchImageBuffer(url);
    if (!buffer) return;
    try {
      cache.byUrl[url] = await computeDHash(buffer);
    } catch {
      /* ignore bad images */
    }
  });
  cache.updatedAt = new Date().toISOString();
  return cache;
}

export async function fetchLineMessageImageBuffer(
  messageId: string,
): Promise<Buffer | null> {
  const id = messageId.trim();
  if (!/^\d{1,64}$/.test(id)) return null;
  const token = await getLineChannelAccessToken();
  if (!token) return null;
  try {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${id}/content`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 12_000_000) return null;
    return bytes;
  } catch {
    return null;
  }
}

export type ImageMatchResult = {
  listing: RentalMatchListing;
  distance: number;
  matchedUrl: string;
};

/** 把客人照片對上已上架出租物件；逾時或失敗回 null。 */
export async function matchPublishedRentalByImage(
  imageBuffer: Buffer,
): Promise<ImageMatchResult | null> {
  const started = Date.now();
  const deadline = started + MATCH_BUDGET_MS;
  let guestHashes: string[];
  try {
    guestHashes = await guestImageHashes(imageBuffer);
  } catch {
    return null;
  }

  if (!process.env.DATABASE_URL) return null;
  const rows = await loadMatchRows();
  if (!rows.length) return null;

  let cache = normalizeCache(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineListingImageHashes),
  );
  const before = Object.keys(cache.byUrl).length;
  cache = await ensureListingHashes(cache, rows, deadline);
  if (Object.keys(cache.byUrl).length !== before) {
    await saveCache(cache);
  }

  const bestByListing = new Map<string, { distance: number; url: string }>();
  for (const row of rows) {
    for (const url of listingImageUrls(row)) {
      const hash = cache.byUrl[url];
      if (!hash) continue;
      for (const guestHash of guestHashes) {
        const distance = hammingHex(guestHash, hash);
        const current = bestByListing.get(row.id);
        if (!current || distance < current.distance) {
          bestByListing.set(row.id, { distance, url });
        }
      }
    }
  }

  const ranked = [...bestByListing.entries()].sort((a, b) => a[1].distance - b[1].distance);
  const [first, second] = ranked;
  if (!first) return null;
  const bestDistance = first[1].distance;
  const margin = second ? second[1].distance - bestDistance : Number.POSITIVE_INFINITY;
  const accepted =
    bestDistance <= SURE_HAMMING || (bestDistance <= MAX_HAMMING && margin >= MIN_MARGIN);
  if (!accepted) return null;
  const best = { listingId: first[0], distance: bestDistance, url: first[1].url };

  const row = rows.find((item) => item.id === best.listingId);
  if (!row) {
    const loaded = await loadPublishedRentalMatchListing(best.listingId);
    if (!loaded) return null;
    return { listing: loaded, distance: best.distance, matchedUrl: best.url };
  }
  const meta = parseListingInternalMeta(row.description);
  return {
    listing: toRentalMatchListing({
      ...row,
      furnitureItems: normalizeItemList(meta.furnitureItems),
      equipmentItems: normalizeItemList(meta.equipmentItems),
      securityDeposit: meta.securityDeposit ?? null,
      availableFrom: meta.availableFrom ?? null,
      shortTermRent: meta.shortTermRent ?? null,
      serviceFee: meta.serviceFee ?? null,
      houseCondition: meta.houseCondition ?? null,
    }),
    distance: best.distance,
    matchedUrl: best.url,
  };
}

async function saveCache(cache: HashCache) {
  try {
    await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineListingImageHashes, cache);
  } catch (error) {
    console.warn("[line-listing-image-match] cache write failed", error);
  }
}

/** 補算尚未快取的物件圖指紋（新上架物件），回傳新增數量。 */
export async function warmListingImageHashes(budgetMs = 20_000): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const rows = await prisma.listing.findMany({
    where: { listingType: ListingType.RENT, isPublished: true },
    select: { id: true, coverImage: true, images: true },
    take: 400,
  });
  const cache = normalizeCache(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineListingImageHashes),
  );
  const before = Object.keys(cache.byUrl).length;
  await ensureListingHashes(cache, rows, Date.now() + budgetMs);
  const added = Object.keys(cache.byUrl).length - before;
  if (added > 0) await saveCache(cache);
  return added;
}

async function loadMatchRows() {
  return prisma.listing.findMany({
    where: { listingType: ListingType.RENT, isPublished: true },
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      address: true,
      price: true,
      areaPing: true,
      areaMain: true,
      areaAncillary: true,
      rooms: true,
      livingRooms: true,
      balconies: true,
      bathrooms: true,
      floor: true,
      totalFloors: true,
      propertyType: true,
      hasElevator: true,
      community: true,
      managementFee: true,
      parkingType: true,
      parkingRent: true,
      areaParkingSpace: true,
      orientation: true,
      petsAllowed: true,
      coverImage: true,
      images: true,
      features: true,
      rentSubsidy: true,
      taxDeductible: true,
      canRegisterAddress: true,
      viewingMethod: true,
      description: true,
    },
    take: 400,
  });
}
