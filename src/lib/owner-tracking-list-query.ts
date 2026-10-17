import {
  formatOwnerCaseAddress,
  lastFollowUp,
  ownerCaseContactCount,
  type OwnerCasePreview,
  type OwnerFollowUpPreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { COMMUNITY_PROPERTY_TYPES } from "@/lib/owner-tracking-form-ui";
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
  },
): OwnerTrackingListRow[] {
  const q = filters.keyword.trim().toLowerCase();
  return store.cases
    .map((c) => ({
      case: c,
      last: lastFollowUp(store, c.id),
      contactCount: ownerCaseContactCount(store, c.id),
    }))
    .filter(({ case: c, last }) => {
      if (filters.assigneeFilter !== "ALL" && c.assignee !== filters.assigneeFilter) return false;
      if (filters.statusFilter !== "ALL" && last?.status !== filters.statusFilter) return false;
      if (filters.propertyTypeFilter !== "ALL" && c.propertyType !== filters.propertyTypeFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        c.ownerName,
        c.phone,
        formatOwnerCaseAddress(c),
        c.city,
        c.district,
        c.community,
        c.layout,
        c.rent,
        c.propertyType,
        c.caseNote,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      const ta = a.last?.createdAt ?? a.case.createdAt;
      const tb = b.last?.createdAt ?? b.case.createdAt;
      return tb.localeCompare(ta);
    });
}
