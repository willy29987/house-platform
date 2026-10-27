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
 * 列表「目前狀態」與狀態篩選用。
 * - 最新追蹤為只可帶看／屋主已出租／可上591 → 直接用
 * - 備註 591:O 且非上述結案／帶看 → 可上591（與試算表同意委託桶一致）
 */
export function resolveOwnerCaseEffectiveStatus(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
): OwnerTrackingStatus {
  const last = lastFollowUp(store, ownerCase.id);
  const lastNorm = last ? normalizeFollowUpStatus(last.status) : "持續聯繫";

  if (lastNorm === "只可帶看" || lastNorm === "屋主已出租" || lastNorm === "可上591") {
    return lastNorm;
  }

  if (is591EntrustCaseNote(ownerCase.caseNote)) {
    return "可上591";
  }

  return lastNorm;
}

export function matchesOwnerCaseStatusFilter(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
  statusFilter: string,
): boolean {
  if (statusFilter === "ALL") return true;
  const want = normalizeFollowUpStatus(statusFilter);
  return resolveOwnerCaseEffectiveStatus(store, ownerCase) === want;
}
