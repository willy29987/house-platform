import { canViewRerentListing, getDaysUntilRelease } from "@/lib/listing-internal-meta";

/** 後台「即將到期」提醒視窗（含已過期） */
export const SOURCE_591_EXPIRY_WARN_DAYS = 7;

export type Listing591ExpiryFields = {
  id: string;
  title: string;
  listingType: "RENT" | "SALE";
  city: string;
  district: string;
  isPublished: boolean;
  source591Id?: string | null;
  source591ExpiresAt?: string | null;
  source591ExpireCheckedAt?: string | null;
  createdByUsername?: string | null;
  createdAt: Date;
};

export function getDaysUntil591Expiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  return getDaysUntilRelease(expiresAt, now);
}

export function is591ExpiryWarning(args: {
  source591ExpiresAt?: string | null;
  now?: Date;
  withinDays?: number;
}): boolean {
  const days = getDaysUntil591Expiry(args.source591ExpiresAt, args.now);
  if (days == null) return false;
  const within = args.withinDays ?? SOURCE_591_EXPIRY_WARN_DAYS;
  return days <= within;
}

export function filterExpiring591Listings<T extends Listing591ExpiryFields>(
  items: T[],
  opts: { currentUsername: string; isSuperAdmin: boolean; withinDays?: number },
): T[] {
  const withinDays = opts.withinDays ?? SOURCE_591_EXPIRY_WARN_DAYS;
  return items
    .filter((l) => l.listingType === "RENT")
    .filter((l) => Boolean((l.source591Id || "").trim()))
    .filter((l) => is591ExpiryWarning({ source591ExpiresAt: l.source591ExpiresAt, withinDays }))
    .filter((l) => canViewRerentListing(l, opts));
}

export function sortExpiring591ListingsSoonestFirst<T extends Listing591ExpiryFields>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDays = getDaysUntil591Expiry(a.source591ExpiresAt) ?? Number.POSITIVE_INFINITY;
    const bDays = getDaysUntil591Expiry(b.source591ExpiresAt) ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function format591ExpiryLabel(expiresAt: string | null | undefined): string {
  const days = getDaysUntil591Expiry(expiresAt);
  if (days == null) return "";
  if (days < 0) return `591 已過期 ${Math.abs(days)} 天`;
  if (days === 0) return "591 今日到期";
  return `591 剩 ${days} 天`;
}
