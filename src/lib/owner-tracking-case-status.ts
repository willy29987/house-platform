/** 屋主案件「列表用目前狀態」：追蹤最新一筆 + 案件備註 591:O（原同意委託） */

import {
  lastFollowUp,
  normalizeFollowUpStatus,
  type OwnerCasePreview,
  type OwnerTrackingStatus,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";

export function extract591FromCaseNote(caseNote: string): string {
  const m = caseNote.match(/591[：:]\s*([^；\n]+)/);
  return m ? m[1].trim() : "";
}

/** 案件備註 591 欄是否為 O（可上591／原同意委託） */
export function is591EntrustCaseNote(caseNote: string): boolean {
  const token = extract591FromCaseNote(caseNote).toUpperCase().split(/[\/／、,，\s]+/)[0];
  if (!token) return false;
  return token === "O" || token === "○" || token === "〇" || token === "是" || token === "Y";
}

/**
 * 列表「目前狀態」徽章用。
 * - 有追蹤紀錄 → 一律以最新一筆為準（手動改狀態才會反映）
 * - 尚無追蹤 → 備註 591:O 推為可上591（Excel／匯入案）
 */
export function resolveOwnerCaseEffectiveStatus(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
): OwnerTrackingStatus {
  const last = lastFollowUp(store, ownerCase.id);
  if (last) {
    return normalizeFollowUpStatus(last.status);
  }
  if (is591EntrustCaseNote(ownerCase.caseNote)) {
    return "可上591";
  }
  return "持續聯繫";
}

/**
 * 狀態篩選。
 * 「可上591」：最新狀態為可上591，或案件備註 591:O（Excel／原備註）；
 * 已結案「屋主已出租」不因備註 O 再進此篩選。
 */
export function matchesOwnerCaseStatusFilter(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
  statusFilter: string,
): boolean {
  if (statusFilter === "ALL") return true;
  const want = normalizeFollowUpStatus(statusFilter);
  const effective = resolveOwnerCaseEffectiveStatus(store, ownerCase);
  if (effective === want) return true;
  if (
    want === "可上591" &&
    effective !== "屋主已出租" &&
    is591EntrustCaseNote(ownerCase.caseNote)
  ) {
    return true;
  }
  return false;
}
