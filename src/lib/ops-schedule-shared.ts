/**
 * 排程設定（可給 client 用）：不含資料庫讀寫。
 */

export const SYNC_INTERVAL_OPTIONS = [2, 3, 4, 6, 8, 12, 24] as const;
export type SyncIntervalHours = (typeof SYNC_INTERVAL_OPTIONS)[number];

export type OpsSchedule = {
  syncEnabled: boolean;
  syncIntervalHours: SyncIntervalHours;
  pushEnabled: boolean;
  pushHour: number;
  pushMinute: number;
  lastSyncAt: string | null;
  lastPushAt: string | null;
  lastPushDay: string | null;
};

export const DEFAULT_OPS_SCHEDULE: OpsSchedule = {
  syncEnabled: true,
  syncIntervalHours: 2,
  pushEnabled: true,
  pushHour: 12,
  pushMinute: 0,
  lastSyncAt: null,
  lastPushAt: null,
  lastPushDay: null,
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function normalizeOpsSchedule(raw: unknown): OpsSchedule {
  const base = { ...DEFAULT_OPS_SCHEDULE };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<OpsSchedule>;
  const interval = clampInt(o.syncIntervalHours, 2, 24, base.syncIntervalHours);
  const allowed = SYNC_INTERVAL_OPTIONS.includes(interval as SyncIntervalHours)
    ? (interval as SyncIntervalHours)
    : base.syncIntervalHours;
  const pushMinuteRaw = clampInt(o.pushMinute, 0, 59, base.pushMinute);
  const pushMinute = ([0, 15, 30, 45] as const).includes(pushMinuteRaw as 0 | 15 | 30 | 45)
    ? pushMinuteRaw
    : 0;

  return {
    syncEnabled: o.syncEnabled !== false,
    syncIntervalHours: allowed,
    pushEnabled: o.pushEnabled !== false,
    pushHour: clampInt(o.pushHour, 0, 23, base.pushHour),
    pushMinute,
    lastSyncAt: typeof o.lastSyncAt === "string" ? o.lastSyncAt : null,
    lastPushAt: typeof o.lastPushAt === "string" ? o.lastPushAt : null,
    lastPushDay: typeof o.lastPushDay === "string" ? o.lastPushDay : null,
  };
}

export function taipeiParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    dayKey: `${year}-${month}-${day}`,
    hour,
    minute: Number(get("minute")),
  };
}

function hoursSince(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - t) / (60 * 60 * 1000);
}

export function shouldRunSync(schedule: OpsSchedule, now = new Date()): boolean {
  if (!schedule.syncEnabled) return false;
  // 靠 lastSyncAt 防重入；配合每 15 分鐘 tick
  return hoursSince(schedule.lastSyncAt, now) >= schedule.syncIntervalHours - 0.05;
}

export function shouldRunPush(schedule: OpsSchedule, now = new Date()): boolean {
  if (!schedule.pushEnabled) return false;
  const { dayKey, hour, minute } = taipeiParts(now);
  if (schedule.lastPushDay === dayKey) return false;
  if (hour !== schedule.pushHour) return false;
  const target = schedule.pushMinute;
  // 15 分鐘 tick：落在設定分～設定分+14
  if (minute < target) return false;
  if (minute > target + 14) return false;
  return true;
}

export function formatPushTimeLabel(schedule: Pick<OpsSchedule, "pushHour" | "pushMinute">) {
  return `${String(schedule.pushHour).padStart(2, "0")}:${String(schedule.pushMinute).padStart(2, "0")}`;
}
