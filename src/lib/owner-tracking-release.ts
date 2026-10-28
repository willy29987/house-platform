/** 屋主追蹤：591 下架後預計釋出日與即將釋出提醒 */

import { getDaysUntilRelease } from "@/lib/listing-internal-meta";
import {
  lastFollowUp,
  newId,
  normalizeFollowUpStatus,
  type OwnerCasePreview,
  type OwnerTrackingStatus,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { addDaysYmd, normalizeNextContactDate, taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

export const OWNER_RELEASE_DAYS_AFTER_591_REMOVED = 365;
export const OWNER_UPCOMING_RELEASE_WINDOW_DAYS = 60;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeExpectedReleaseDate(raw: string | null | undefined): string {
  return normalizeNextContactDate(raw);
}

export function defaultReleaseDateOneYearFrom(now = new Date()): string {
  return addDaysYmd(taipeiTodayYmd(now), OWNER_RELEASE_DAYS_AFTER_591_REMOVED, now);
}

/** 591 下架後已設定釋出日、且最新追蹤為下架紀錄（含舊版「無效／重複」） */
export function isOwnerCaseMarked591ReleaseTrack(
  store: OwnerTrackingStore,
  caseId: string,
): boolean {
  const last = lastFollowUp(store, caseId);
  if (!last) return false;
  if (last.note.includes("591") && last.note.includes("下架")) return true;
  if (last.note.includes("可再開發") && last.note.includes("591")) return true;
  const raw = last.status.trim();
  return raw === "無效／重複";
}

/** 591 下架釋出軌道且距離預計釋出 ≤ 60 天（約標記後第 10 個月起） */
export function isOwnerCaseUpcomingRelease(
  store: OwnerTrackingStore,
  ownerCase: OwnerCasePreview,
  now = new Date(),
): boolean {
  const ymd = normalizeExpectedReleaseDate(ownerCase.expectedReleaseDate);
  if (!ymd || !YMD_RE.test(ymd)) return false;
  if (!isOwnerCaseMarked591ReleaseTrack(store, ownerCase.id)) return false;
  const days = getDaysUntilRelease(ymd, now);
  if (days == null) return false;
  return days >= 0 && days <= OWNER_UPCOMING_RELEASE_WINDOW_DAYS;
}

export function filterUpcomingOwnerCases(
  store: OwnerTrackingStore,
  cases: OwnerCasePreview[],
  opts: { currentUsername: string; isSuperAdmin: boolean },
): OwnerCasePreview[] {
  return cases.filter((c) => {
    if (!isOwnerCaseUpcomingRelease(store, c)) return false;
    if (opts.isSuperAdmin) return true;
    const a = c.assignee.trim();
    if (!a || a === "—") return true;
    return a === opts.currentUsername.trim();
  });
}

export function sortOwnerCasesByReleaseSoonest(
  store: OwnerTrackingStore,
  cases: OwnerCasePreview[],
): OwnerCasePreview[] {
  return [...cases].sort((a, b) => {
    const da = getDaysUntilRelease(a.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    const db = getDaysUntilRelease(b.expectedReleaseDate) ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export type Apply591RemovedResult = {
  store: OwnerTrackingStore;
  changed: boolean;
  updatedCaseIds: string[];
};

const SKIP_AUTO_591_RELEASE: OwnerTrackingStatus[] = ["屋主已出租"];

/**
 * 591 判定下架時：首次進入釋出軌道時設定一年後釋出日並清空下次聯繫；
 * 已有釋出日的再檢查、或狀態為「屋主已出租」時不改動案件欄位／不清聯繫日。
 */
export function apply591RemovedToOwnerStore(
  store: OwnerTrackingStore,
  removedCaseIds: string[],
  opts: { now?: Date; createdBy?: string } = {},
): Apply591RemovedResult {
  const now = opts.now ?? new Date();
  const createdBy = opts.createdBy?.trim() || "system";
  const idSet = new Set(removedCaseIds.filter(Boolean));
  if (idSet.size === 0) {
    return { store, changed: false, updatedCaseIds: [] };
  }

  const releaseYmd = defaultReleaseDateOneYearFrom(now);
  let casesChanged = false;
  const cases = store.cases.map((c) => {
    if (!idSet.has(c.id)) return c;
    const last = lastFollowUp(store, c.id);
    if (last && SKIP_AUTO_591_RELEASE.includes(normalizeFollowUpStatus(last.status))) {
      return c;
    }
    const existing = normalizeExpectedReleaseDate(c.expectedReleaseDate);
    // 已在釋出軌道：再檢查不得清空同事後來重設的下次聯繫日
    if (existing) return c;
    casesChanged = true;
    return {
      ...c,
      expectedReleaseDate: releaseYmd,
      nextContactDate: "",
    };
  });

  const followUps = [...store.followUps];
  const updatedCaseIds: string[] = [];

  for (const caseId of idSet) {
    const ownerCase = cases.find((c) => c.id === caseId);
    if (!ownerCase) continue;
    const last = lastFollowUp({ cases, followUps }, caseId);
    if (last && SKIP_AUTO_591_RELEASE.includes(normalizeFollowUpStatus(last.status))) continue;

    const releaseForCase = normalizeExpectedReleaseDate(ownerCase.expectedReleaseDate) || releaseYmd;
    if (isOwnerCaseMarked591ReleaseTrack({ cases, followUps }, caseId)) {
      if (last?.note.includes("591")) continue;
    }

    followUps.push({
      id: newId("fu"),
      caseId,
      status: "持續聯繫",
      note: `591 連結已下架；預計 ${releaseForCase} 可再開發`,
      createdBy,
      createdAt: now.toISOString(),
    });
    updatedCaseIds.push(caseId);
  }

  const changed = updatedCaseIds.length > 0 || casesChanged;
  return {
    store: { cases, followUps },
    changed,
    updatedCaseIds,
  };
}
