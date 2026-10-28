import { resolveOwnerCaseEffectiveStatus } from "@/lib/owner-tracking-case-status";
import {
  formatOwnerCaseAddress,
  normalizeFollowUpStatus,
  type OwnerCasePreview,
  type OwnerFollowUpPreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { propertyTypeLabel } from "@/lib/property-type-label";

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** 空白分隔多關鍵字（全部都要符合） */
export function tokenizeOwnerSearchQuery(raw: string): string[] {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function buildHaystack(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
  last: OwnerFollowUpPreview | null,
): { text: string; phoneDigits: string } {
  const effective = resolveOwnerCaseEffectiveStatus(store, ownerCase);
  const typeLabel = propertyTypeLabel(ownerCase.propertyType);
  const parts = [
    ownerCase.ownerName,
    ownerCase.phone,
    formatOwnerCaseAddress(ownerCase),
    ownerCase.city,
    ownerCase.district,
    ownerCase.address,
    ownerCase.community,
    ownerCase.layout,
    ownerCase.rent,
    ownerCase.propertyType,
    typeLabel !== "—" ? typeLabel : "",
    ownerCase.caseNote,
    ownerCase.listingUrl,
    ownerCase.assignee,
    ownerCase.parkingNumber,
    ownerCase.floor,
    effective,
    last?.status ? normalizeFollowUpStatus(last.status) : "",
    last?.note ?? "",
  ];
  return {
    text: parts.join(" ").toLowerCase(),
    phoneDigits: normalizePhoneDigits(ownerCase.phone),
  };
}

function tokenMatchesHaystack(token: string, hay: { text: string; phoneDigits: string }): boolean {
  const digits = normalizePhoneDigits(token);
  if (digits.length >= 3 && hay.phoneDigits.includes(digits)) {
    return true;
  }
  return hay.text.includes(token);
}

export function matchesOwnerCaseSearch(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
  last: OwnerFollowUpPreview | null,
  rawQuery: string,
): boolean {
  const tokens = tokenizeOwnerSearchQuery(rawQuery);
  if (tokens.length === 0) return true;
  const hay = buildHaystack(store, ownerCase, last);
  return tokens.every((token) => tokenMatchesHaystack(token, hay));
}
