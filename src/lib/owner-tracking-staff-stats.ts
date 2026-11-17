/** 屋主追蹤：依員工彙總電訪與待聯繫（營運總覽用） */

import {
  matchesContactFilter,
  normalizeNextContactDate,
  taipeiTodayYmd,
} from "@/lib/owner-tracking-next-contact";
import type { OwnerFollowUpPreview, OwnerTrackingStore } from "@/lib/owner-tracking-preview";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoToTaipeiYmd(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) || taipeiTodayYmd(now);
}

export function normalizeStaffOpsDate(raw: string | null | undefined, now = new Date()): string {
  const ymd = normalizeNextContactDate(raw);
  if (ymd && YMD_RE.test(ymd)) return ymd;
  return taipeiTodayYmd(now);
}

/** R001／system＝板橋自抓（畫面顯示 company） */
export function isCompanySyncCallActor(username: string | null | undefined): boolean {
  const value = (username ?? "").trim().toLowerCase();
  return value === "r001" || value === "system";
}

/**
 * 電訪＝當天追蹤筆。自抓只算「全新案件」的第一筆；內容有變的更新補筆不算。
 * 另排除 591 下架／釋出／帶入上架文案與無效案。
 */
export function isFollowUpExcludedFromDailyCalls(
  f: Pick<OwnerFollowUpPreview, "note" | "status" | "createdBy">,
): boolean {
  const note = f.note.trim();
  if (note.includes("591") && note.includes("下架")) return true;
  if (note.includes("可再開發") && note.includes("591")) return true;
  if (note.includes("下架") && (note.includes("連結") || note.includes("釋出"))) return true;
  if (note.includes("591 帶入") || note.includes("帶入上架")) return true;
  return f.status.trim() === "無效／重複";
}

/**
 * 自抓「內容更新」灌的空備註：同一案件若已有更早追蹤，這筆不算／可刪。
 * 全新案件的第一筆空備註要保留並計入電訪。
 */
export function isCompanySyncContentUpdateFollowUp(
  f: Pick<OwnerFollowUpPreview, "id" | "caseId" | "note" | "createdBy" | "createdAt">,
  store: Pick<OwnerTrackingStore, "followUps">,
): boolean {
  if (!isCompanySyncCallActor(f.createdBy)) return false;
  if (f.note.trim()) return false;
  return store.followUps.some((other) => {
    if (other.caseId !== f.caseId || other.id === f.id) return false;
    if (other.createdAt < f.createdAt) return true;
    if (other.createdAt === f.createdAt && other.id.localeCompare(f.id) < 0) return true;
    return false;
  });
}

/** 刪除自抓內容更新灌進去的空備註電訪（保留每案第一筆＝新建）。 */
export function purgeCompanySyncContentUpdateFollowUps(
  store: OwnerTrackingStore,
): { store: OwnerTrackingStore; removed: number } {
  const followUps = store.followUps.filter((f) => !isCompanySyncContentUpdateFollowUp(f, store));
  return {
    store: { ...store, followUps },
    removed: store.followUps.length - followUps.length,
  };
}

function bump(map: Record<string, number>, key: string, by = 1) {
  const k = key.trim();
  if (!k || k === "—") return;
  map[k] = (map[k] ?? 0) + by;
}

/** 指定台北日的追蹤筆數（電訪代理指標）：依 followUp.createdBy；排除 591 下架類與自抓內容更新補筆 */
export function countFollowUpsByStaffOnDate(
  store: OwnerTrackingStore,
  dayYmd: string,
  now = new Date(),
): Record<string, number> {
  const day = normalizeStaffOpsDate(dayYmd, now);
  const out: Record<string, number> = {};
  for (const f of store.followUps) {
    if (isoToTaipeiYmd(f.createdAt, now) !== day) continue;
    if (isFollowUpExcludedFromDailyCalls(f)) continue;
    if (isCompanySyncContentUpdateFollowUp(f, store)) continue;
    const actor = isCompanySyncCallActor(f.createdBy) ? "R001" : f.createdBy;
    bump(out, actor);
  }
  return out;
}

/** @deprecated 改用 countFollowUpsByStaffOnDate */
export function countFollowUpsTodayByStaff(
  store: OwnerTrackingStore,
  now = new Date(),
): Record<string, number> {
  return countFollowUpsByStaffOnDate(store, taipeiTodayYmd(now), now);
}

/** 目前待聯繫（含逾期）件數：依案件 assignee（與選定歷史日無關） */
export function countContactDueByStaff(
  store: OwnerTrackingStore,
  now = new Date(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of store.cases) {
    if (!matchesContactFilter(c.nextContactDate, "DUE", now)) continue;
    bump(out, c.assignee);
  }
  return out;
}

export type StaffDailyOpsRow = {
  username: string;
  followUpsToday: number;
  /** 僅「看今天」時有意義；歷史日為 0 */
  contactDue: number;
};

export type StaffOpsFollowUpRow = OwnerFollowUpPreview & {
  caseAddress: string;
  caseOwnerName: string;
  caseAssignee: string;
};

/**
 * 組出看板列。管理員看全部職員＋當日有電訪／（今日）待聯繫的人；業務只看自己。
 */
export function buildStaffDailyOpsRows(
  store: OwnerTrackingStore,
  opts: {
    staffUsernames: string[];
    currentUsername: string;
    isSuperAdmin: boolean;
    /** 台北 YYYY-MM-DD；預設今天 */
    dayYmd?: string;
  },
  now = new Date(),
): StaffDailyOpsRow[] {
  const day = normalizeStaffOpsDate(opts.dayYmd, now);
  const today = taipeiTodayYmd(now);
  const isToday = day === today;
  const followUps = countFollowUpsByStaffOnDate(store, day, now);
  const contactDue = isToday ? countContactDueByStaff(store, now) : {};

  if (!opts.isSuperAdmin) {
    const me = opts.currentUsername.trim();
    if (!me) return [];
    return [
      {
        username: me,
        followUpsToday: followUps[me] ?? 0,
        contactDue: contactDue[me] ?? 0,
      },
    ];
  }

  const names = new Set(opts.staffUsernames.map((u) => u.trim()).filter(Boolean));
  for (const key of Object.keys(followUps)) names.add(key);
  if (isToday) {
    for (const key of Object.keys(contactDue)) names.add(key);
  }

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .map((username) => ({
      username,
      followUpsToday: followUps[username] ?? 0,
      contactDue: contactDue[username] ?? 0,
    }));
}

/** 指定日的電訪明細（新→舊；已排除 591 下架類） */
export function listFollowUpsOnDate(
  store: OwnerTrackingStore,
  dayYmd: string,
  now = new Date(),
): StaffOpsFollowUpRow[] {
  const day = normalizeStaffOpsDate(dayYmd, now);
  const caseById = new Map(store.cases.map((c) => [c.id, c]));
  return store.followUps
    .filter(
      (f) =>
        isoToTaipeiYmd(f.createdAt, now) === day &&
        !isFollowUpExcludedFromDailyCalls(f) &&
        !isCompanySyncContentUpdateFollowUp(f, store),
    )
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map((f) => {
      const ownerCase = caseById.get(f.caseId);
      return {
        ...f,
        createdBy: isCompanySyncCallActor(f.createdBy) ? "R001" : f.createdBy,
        caseAddress: ownerCase
          ? [ownerCase.city, ownerCase.district, ownerCase.address].filter(Boolean).join("")
          : "",
        caseOwnerName: ownerCase?.ownerName ?? "",
        caseAssignee: ownerCase?.assignee ?? "",
      };
    });
}
