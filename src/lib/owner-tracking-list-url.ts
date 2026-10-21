/** 屋主追蹤列表：篩選／分頁寫入 URL，方便返回與登入後回到原畫面 */

import {
  parseOwnerTrackingListing591Filter,
  type OwnerTrackingListing591Filter,
} from "@/lib/owner-tracking-listing-checks";
import {
  parseOwnerTrackingContactFilter,
  type OwnerTrackingContactFilter,
} from "@/lib/owner-tracking-next-contact";

export const OWNER_TRACKING_LIST_PATH = "/admin/owner-tracking";

export type OwnerTrackingListUrlState = {
  keyword: string;
  statusFilter: string;
  propertyTypeFilter: string;
  assigneeFilter: string;
  listing591Filter: OwnerTrackingListing591Filter;
  contactFilter: OwnerTrackingContactFilter;
  page: number;
};

export function parseOwnerTrackingListSearch(
  params: URLSearchParams,
  opts: { isSuperAdmin: boolean; currentUsername: string },
): OwnerTrackingListUrlState {
  const pageRaw = Number.parseInt(params.get("page") ?? "1", 10);
  const assigneeRaw = params.get("assignee");
  let assigneeFilter = assigneeRaw ?? (opts.isSuperAdmin ? "ALL" : opts.currentUsername);
  if (!assigneeFilter.trim()) {
    assigneeFilter = opts.isSuperAdmin ? "ALL" : opts.currentUsername;
  }

  return {
    keyword: params.get("q") ?? "",
    statusFilter: params.get("status") ?? "ALL",
    propertyTypeFilter: params.get("ptype") ?? "ALL",
    assigneeFilter,
    listing591Filter: parseOwnerTrackingListing591Filter(params.get("l591")),
    contactFilter: parseOwnerTrackingContactFilter(params.get("contact")),
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function buildOwnerTrackingListQuery(state: OwnerTrackingListUrlState): string {
  const p = new URLSearchParams();
  const q = state.keyword.trim();
  if (q) p.set("q", q);
  if (state.statusFilter !== "ALL") p.set("status", state.statusFilter);
  if (state.propertyTypeFilter !== "ALL") p.set("ptype", state.propertyTypeFilter);
  if (state.assigneeFilter !== "ALL") p.set("assignee", state.assigneeFilter);
  if (state.listing591Filter !== "ALL") p.set("l591", state.listing591Filter);
  if (state.contactFilter !== "ALL") p.set("contact", state.contactFilter);
  if (state.page > 1) p.set("page", String(state.page));
  return p.toString();
}

export function ownerTrackingListHref(state: OwnerTrackingListUrlState): string {
  const qs = buildOwnerTrackingListQuery(state);
  return qs ? `${OWNER_TRACKING_LIST_PATH}?${qs}` : OWNER_TRACKING_LIST_PATH;
}

/** 子頁（詳情／編輯）帶上的 list 查詢字串（raw query，不含 ?） */
export function ownerTrackingListHrefFromListParam(listParam: string | null | undefined): string {
  const raw = listParam?.trim();
  if (!raw) return OWNER_TRACKING_LIST_PATH;
  return `${OWNER_TRACKING_LIST_PATH}?${raw}`;
}

export function appendOwnerTrackingListContext(path: string, listQuery: string): string {
  if (!listQuery) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}list=${encodeURIComponent(listQuery)}`;
}
