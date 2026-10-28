import {
  matchesListing591Filter,
  resolveListing591ListCategory,
  type Listing591CheckEntry,
  type OwnerTrackingListing591Filter,
} from "@/lib/owner-tracking-listing-checks";
import { matchesOwnerCaseStatusFilter, resolveOwnerCaseEffectiveStatus } from "@/lib/owner-tracking-case-status";
import {
  canViewOwnerTrackingCase,
  matchesOwnerTrackingAssigneeFilter,
  lastFollowUp,
  ownerCaseContactCount,
  type OwnerCasePreview,
  type OwnerFollowUpPreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import {
  contactDueCategory,
  matchesContactFilter,
  normalizeNextContactDate,
  type OwnerTrackingContactFilter,
} from "@/lib/owner-tracking-next-contact";
import { COMMUNITY_PROPERTY_TYPES } from "@/lib/owner-tracking-form-ui";
import { matchesOwnerCaseSearch } from "@/lib/owner-tracking-list-search";
import { propertyTypeLabel } from "@/lib/property-type-label";

export type OwnerTrackingListRow = {
  case: OwnerCasePreview;
  last: OwnerFollowUpPreview | null;
  contactCount: number;
};

/** 列表「社區」欄：有社區名優先；否則非社區型物件顯示類別。 */
export function listCommunityCell(item: OwnerCasePreview): string {
  const community = (item.community ?? "").trim();
  if (community) return community;
  if ((COMMUNITY_PROPERTY_TYPES as readonly string[]).includes(item.propertyType)) {
    return "—";
  }
  const label = propertyTypeLabel(item.propertyType);
  return label !== "—" ? label : item.propertyType || "—";
}

export function buildOwnerTrackingListRows(
  store: OwnerTrackingStore,
  filters: {
    keyword: string;
    statusFilter: string;
    propertyTypeFilter: string;
    assigneeFilter: string;
    listing591Filter?: OwnerTrackingListing591Filter;
    listingChecksByCaseId?: Record<string, Listing591CheckEntry>;
    contactFilter?: OwnerTrackingContactFilter;
    currentUsername?: string;
    isSuperAdmin?: boolean;
  },
): OwnerTrackingListRow[] {
  const listing591Filter = filters.listing591Filter ?? "ALL";
  const contactFilter = filters.contactFilter ?? "ALL";
  const checks = filters.listingChecksByCaseId ?? {};
  const visibility =
    filters.isSuperAdmin === false && filters.currentUsername
      ? { currentUsername: filters.currentUsername, isSuperAdmin: false as const }
      : null;
  const rows = store.cases
    .map((c) => ({
      case: c,
      last: lastFollowUp(store, c.id),
      contactCount: ownerCaseContactCount(store, c.id),
    }))
    .filter(({ case: c, last }) => {
      if (visibility && !canViewOwnerTrackingCase(c, visibility)) return false;
      if (!matchesOwnerTrackingAssigneeFilter(c.assignee, filters.assigneeFilter)) return false;
      if (!matchesOwnerCaseStatusFilter(store, c, filters.statusFilter)) return false;
      if (filters.propertyTypeFilter !== "ALL" && c.propertyType !== filters.propertyTypeFilter) {
        return false;
      }
      if (listing591Filter !== "ALL") {
        const category = resolveListing591ListCategory(c.listingUrl, checks[c.id]);
        if (!matchesListing591Filter(category, listing591Filter)) return false;
      }
      if (contactFilter !== "ALL" && !matchesContactFilter(c.nextContactDate, contactFilter)) {
        return false;
      }
      if (!matchesOwnerCaseSearch(store, c, last, filters.keyword)) return false;
      return true;
    })
    .sort((a, b) => {
      if (contactFilter === "DUE") {
        const rank = (ymd: string) => {
          const cat = contactDueCategory(ymd);
          if (cat === "overdue") return 0;
          if (cat === "today") return 1;
          return 2;
        };
        const ra = rank(a.case.nextContactDate);
        const rb = rank(b.case.nextContactDate);
        if (ra !== rb) return ra - rb;
        const da = normalizeNextContactDate(a.case.nextContactDate);
        const db = normalizeNextContactDate(b.case.nextContactDate);
        if (da !== db) return da.localeCompare(db);
      }
      return b.case.createdAt.localeCompare(a.case.createdAt);
    });
  return rows;
}

/** 列表「今日待聯繫」可見筆數（今日 + 已逾期，與列表篩選一致） */
export function countContactDueCases(
  store: OwnerTrackingStore,
  opts: { assigneeFilter: string; isSuperAdmin: boolean; currentUsername: string },
  now = new Date(),
): number {
  const assigneeFilter = opts.isSuperAdmin ? opts.assigneeFilter : opts.currentUsername;
  const visibility =
    !opts.isSuperAdmin && opts.currentUsername
      ? { currentUsername: opts.currentUsername, isSuperAdmin: false as const }
      : null;
  return store.cases.filter((c) => {
    if (visibility && !canViewOwnerTrackingCase(c, visibility)) return false;
    if (!matchesOwnerTrackingAssigneeFilter(c.assignee, assigneeFilter)) return false;
    return matchesContactFilter(c.nextContactDate, "DUE", now);
  }).length;
}

/** 列表可見、已排程「之後日期」聯繫（非今日／逾期） */
export function countContactUpcomingCases(
  store: OwnerTrackingStore,
  opts: { assigneeFilter: string; isSuperAdmin: boolean; currentUsername: string },
  now = new Date(),
): number {
  const assigneeFilter = opts.isSuperAdmin ? opts.assigneeFilter : opts.currentUsername;
  const visibility =
    !opts.isSuperAdmin && opts.currentUsername
      ? { currentUsername: opts.currentUsername, isSuperAdmin: false as const }
      : null;
  return store.cases.filter((c) => {
    if (visibility && !canViewOwnerTrackingCase(c, visibility)) return false;
    if (!matchesOwnerTrackingAssigneeFilter(c.assignee, assigneeFilter)) return false;
    return matchesContactFilter(c.nextContactDate, "LATER", now);
  }).length;
}
