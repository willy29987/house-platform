/** 屋主追蹤：依員工彙總今日電訪與待聯繫（營運總覽用） */

import {
  matchesContactFilter,
  taipeiTodayYmd,
} from "@/lib/owner-tracking-next-contact";
import type { OwnerTrackingStore } from "@/lib/owner-tracking-preview";

function isoToTaipeiYmd(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) || taipeiTodayYmd(now);
}

function bump(map: Record<string, number>, key: string, by = 1) {
  const k = key.trim();
  if (!k || k === "—") return;
  map[k] = (map[k] ?? 0) + by;
}

/** 今日追蹤筆數（電訪代理指標）：依 followUp.createdBy + 台北日 */
export function countFollowUpsTodayByStaff(
  store: OwnerTrackingStore,
  now = new Date(),
): Record<string, number> {
  const today = taipeiTodayYmd(now);
  const out: Record<string, number> = {};
  for (const f of store.followUps) {
    if (isoToTaipeiYmd(f.createdAt, now) !== today) continue;
    bump(out, f.createdBy);
  }
  return out;
}

/** 今日待聯繫（含逾期）件數：依案件 assignee */
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
  contactDue: number;
};

/**
 * 組出看板列。管理員看全部職員＋今日有電訪／待聯繫的人；業務只看自己。
 */
export function buildStaffDailyOpsRows(
  store: OwnerTrackingStore,
  opts: {
    staffUsernames: string[];
    currentUsername: string;
    isSuperAdmin: boolean;
  },
  now = new Date(),
): StaffDailyOpsRow[] {
  const followUpsToday = countFollowUpsTodayByStaff(store, now);
  const contactDue = countContactDueByStaff(store, now);

  if (!opts.isSuperAdmin) {
    const me = opts.currentUsername.trim();
    if (!me) return [];
    return [
      {
        username: me,
        followUpsToday: followUpsToday[me] ?? 0,
        contactDue: contactDue[me] ?? 0,
      },
    ];
  }

  const names = new Set(
    opts.staffUsernames.map((u) => u.trim()).filter(Boolean),
  );
  for (const key of Object.keys(followUpsToday)) names.add(key);
  for (const key of Object.keys(contactDue)) names.add(key);

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .map((username) => ({
      username,
      followUpsToday: followUpsToday[username] ?? 0,
      contactDue: contactDue[username] ?? 0,
    }));
}
