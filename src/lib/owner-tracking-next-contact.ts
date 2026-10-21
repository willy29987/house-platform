/** 屋主追蹤：下次聯繫日（Asia/Taipei 日曆日） */

const TAIPEI_TZ = "Asia/Taipei";

export type ContactDueCategory = "none" | "overdue" | "today" | "upcoming";

export type OwnerTrackingContactFilter = "ALL" | "DUE" | "TODAY" | "OVERDUE" | "LATER" | "NONE";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function taipeiTodayYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

export function normalizeNextContactDate(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (YMD_RE.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

export function addDaysYmd(baseYmd: string, days: number, now = new Date()): string {
  const start = baseYmd && YMD_RE.test(baseYmd) ? baseYmd : taipeiTodayYmd(now);
  const dt = new Date(`${start}T12:00:00+08:00`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

export function contactDueCategory(
  nextContactDate: string | null | undefined,
  now = new Date(),
): ContactDueCategory {
  const ymd = normalizeNextContactDate(nextContactDate);
  if (!ymd) return "none";
  const today = taipeiTodayYmd(now);
  if (ymd < today) return "overdue";
  if (ymd === today) return "today";
  return "upcoming";
}

export function parseOwnerTrackingContactFilter(raw: string | null | undefined): OwnerTrackingContactFilter {
  const v = (raw ?? "ALL").toUpperCase();
  if (v === "DUE" || v === "TODAY" || v === "OVERDUE" || v === "LATER" || v === "NONE") return v;
  return "ALL";
}

/** 今日待聯繫視圖：含今日與已逾期（舊 URL 的 TODAY／OVERDUE 仍各自篩選） */
export function isContactDueTodayView(filter: OwnerTrackingContactFilter): boolean {
  return filter === "DUE";
}

export function matchesContactFilter(
  nextContactDate: string | null | undefined,
  filter: OwnerTrackingContactFilter,
  now = new Date(),
): boolean {
  if (filter === "ALL") return true;
  const category = contactDueCategory(nextContactDate, now);
  if (filter === "NONE") return category === "none";
  if (filter === "DUE") return category === "today" || category === "overdue";
  if (filter === "TODAY") return category === "today";
  if (filter === "OVERDUE") return category === "overdue";
  return category === "upcoming";
}

export function overdueDays(nextContactDate: string, now = new Date()): number {
  const ymd = normalizeNextContactDate(nextContactDate);
  if (!ymd) return 0;
  const today = taipeiTodayYmd(now);
  if (ymd >= today) return 0;
  const a = new Date(`${ymd}T12:00:00+08:00`).getTime();
  const b = new Date(`${today}T12:00:00+08:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** 列表 badge / 欄位文字 */
export function formatNextContactLabel(nextContactDate: string | null | undefined, now = new Date()): string {
  const ymd = normalizeNextContactDate(nextContactDate);
  if (!ymd) return "未排程";
  const category = contactDueCategory(ymd, now);
  if (category === "today") return "今日聯繫";
  if (category === "overdue") {
    const days = overdueDays(ymd, now);
    return days > 0 ? `已逾期 ${days} 天` : "已逾期";
  }
  const [, mm, dd] = ymd.split("-");
  return `${mm}/${dd} 再聯繫`;
}
