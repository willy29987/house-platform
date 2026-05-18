import type { FurnitureApplianceValue } from "@/lib/furniture-appliance-value";

export const LISTING_META_PREFIX = "__listing_meta__:";

export type ListingInternalMeta = {
  createdByUsername?: string;
  furnitureProvided?: FurnitureApplianceValue;
  applianceProvided?: FurnitureApplianceValue;
  shortTermRent?: string | null;
  serviceFee?: string | null;
  registrationUse?: string | null;
  securityDeposit?: string | null;
  availableFrom?: string | null;
  householdsPerFloor?: string | null;
  unpublishCategory?: "DEAL" | "PAUSE" | null;
  unpublishNote?: string | null;
  expectedReleaseDate?: string | null;
};

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
