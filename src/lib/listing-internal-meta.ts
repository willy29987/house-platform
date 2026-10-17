import type { FurnitureApplianceValue } from "@/lib/furniture-appliance-value";

export const LISTING_META_PREFIX = "__listing_meta__:";

export type ListingInternalMeta = {
  createdByUsername?: string;
  furnitureProvided?: FurnitureApplianceValue;
  applianceProvided?: FurnitureApplianceValue;
  furnitureItems?: string[];
  equipmentItems?: string[];
  shortTermRent?: string | null;
  serviceFee?: string | null;
  registrationUse?: string | null;
  specialMatters?: string | null;
  otherFees?: string | null;
  securityDeposit?: string | null;
  availableFrom?: string | null;
  householdsPerFloor?: string | null;
  roomNumber?: string | null;
  unpublishCategory?: "DEAL" | "PAUSE" | "OTHER" | null;
  unpublishNote?: string | null;
  expectedReleaseDate?: string | null;
  unpublishedAt?: string | null;
};

/** 距離預計釋出日期還有幾天，過期/沒設定回傳 null */
export function getDaysUntilRelease(expectedReleaseDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!expectedReleaseDate) return null;
  const release = new Date(expectedReleaseDate);
  if (!Number.isFinite(release.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const releaseDay = new Date(release.getFullYear(), release.getMonth(), release.getDate());
  const diffMs = releaseDay.getTime() - startOfToday.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/** 是否為「即將釋出」物件：未上架 + 距預計釋出日期 ≤ 60 天且 ≥ 0 */
export function isUpcomingRelease(args: {
  isPublished: boolean;
  expectedReleaseDate: string | null | undefined;
  now?: Date;
  windowDays?: number;
}): boolean {
  const { isPublished, expectedReleaseDate, now, windowDays = 60 } = args;
  if (isPublished) return false;
  const days = getDaysUntilRelease(expectedReleaseDate, now);
  if (days == null) return false;
  return days >= 0 && days <= windowDays;
}

/** 回租／即將釋出列表用的最小欄位 */
export type UpcomingRentListing = {
  isPublished: boolean;
  expectedReleaseDate?: string | null;
  unpublishedAt?: string | null;
  createdAt: Date;
  listingType: "RENT" | "SALE";
  createdByUsername?: string | null;
};

/** 回租／即將釋出：管理員看全部業務；業務帳號只看自己刊登（createdByUsername） */
export function canViewRerentListing(
  listing: Pick<UpcomingRentListing, "createdByUsername">,
  opts: { currentUsername: string; isSuperAdmin: boolean },
): boolean {
  if (opts.isSuperAdmin) return true;
  return listing.createdByUsername === opts.currentUsername;
}

export function filterUpcomingRentListings<T extends UpcomingRentListing>(
  items: T[],
  opts: { currentUsername: string; isSuperAdmin: boolean },
): T[] {
  return items
    .filter((l) => l.listingType === "RENT")
    .filter((l) =>
      isUpcomingRelease({
        isPublished: l.isPublished,
        expectedReleaseDate: l.expectedReleaseDate,
      }),
    )
    .filter((l) => canViewRerentListing(l, opts));
}

/** 回租分頁：下架時間新→舊 */
export function sortUpcomingRentListingsNewestFirst<T extends UpcomingRentListing>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aT = a.unpublishedAt ? new Date(a.unpublishedAt).getTime() : 0;
    const bT = b.unpublishedAt ? new Date(b.unpublishedAt).getTime() : 0;
    if (aT !== bT) return bT - aT;
    const aDays = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    const bDays = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** 首頁提醒：距釋出日越近越前 */
export function sortUpcomingRentListingsByReleaseSoonest<T extends UpcomingRentListing>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDays = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    const bDays = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    return aDays - bDays;
  });
}

/** 民國年格式化：2026-05-22 → 115/5/22 */
export function formatRocDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  const roc = date.getFullYear() - 1911;
  return `${roc}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function unpublishCategoryLabel(category: ListingInternalMeta["unpublishCategory"]): string {
  switch (category) {
    case "DEAL":
      return "成交下架";
    case "PAUSE":
      return "暫停出租";
    case "OTHER":
      return "其他原因";
    default:
      return "—";
  }
}

export function parseListingInternalMeta(description: string | null | undefined): ListingInternalMeta {
  if (!description) return {};
  if (!description.startsWith(LISTING_META_PREFIX)) return {};
  const raw = description.slice(LISTING_META_PREFIX.length).trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ListingInternalMeta;
  } catch {
    return {};
  }
}

export function toListingDescription(meta: ListingInternalMeta) {
  return `${LISTING_META_PREFIX}${JSON.stringify(meta)}`;
}
