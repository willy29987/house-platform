/**
 * 離線驗證下次聯繫日邏輯（與 src/lib/owner-tracking-next-contact.ts 一致）
 * node scripts/verify-owner-tracking-next-contact.mjs
 */

const TAIPEI_TZ = "Asia/Taipei";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function taipeiTodayYmd(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

function addDaysYmd(baseYmd, days, now = new Date()) {
  const start = baseYmd && YMD_RE.test(baseYmd) ? baseYmd : taipeiTodayYmd(now);
  const dt = new Date(`${start}T12:00:00+08:00`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

function contactDueCategory(nextContactDate, now = new Date()) {
  const ymd = (nextContactDate ?? "").trim();
  if (!ymd) return "none";
  const today = taipeiTodayYmd(now);
  if (ymd < today) return "overdue";
  if (ymd === today) return "today";
  return "upcoming";
}

function matchesOwnerTrackingAssigneeFilter(assignee, assigneeFilter) {
  if (assigneeFilter === "ALL") return true;
  const a = String(assignee ?? "").trim();
  if (!a || a === "—") return true;
  return a === assigneeFilter.trim();
}

function matchesContactFilter(nextContactDate, filter, now = new Date()) {
  if (filter === "ALL") return true;
  const category = contactDueCategory(nextContactDate, now);
  if (filter === "NONE") return category === "none";
  if (filter === "DUE") return category === "today" || category === "overdue";
  if (filter === "TODAY") return category === "today";
  if (filter === "OVERDUE") return category === "overdue";
  return category === "upcoming";
}

const fixedNow = new Date("2026-10-21T15:00:00+08:00");
const today = taipeiTodayYmd(fixedNow);
const tomorrow = addDaysYmd(today, 1, fixedNow);
const yesterday = addDaysYmd(today, -1, fixedNow);

const checks = [
  [addDaysYmd(today, 1, fixedNow), tomorrow],
  [contactDueCategory(today, fixedNow), "today"],
  [contactDueCategory(yesterday, fixedNow), "overdue"],
  [contactDueCategory(tomorrow, fixedNow), "upcoming"],
  [matchesContactFilter(today, "TODAY", fixedNow), true],
  [matchesContactFilter("", "NONE", fixedNow), true],
  [matchesContactFilter(tomorrow, "LATER", fixedNow), true],
  [matchesContactFilter(yesterday, "DUE", fixedNow), true],
  [matchesContactFilter(today, "DUE", fixedNow), true],
  [matchesContactFilter(tomorrow, "DUE", fixedNow), false],
  [matchesOwnerTrackingAssigneeFilter("—", "R001"), true],
  [matchesOwnerTrackingAssigneeFilter("R002", "R001"), false],
];

function pickMergedYmd(cloudYmd, localYmd, preferLocal) {
  if (preferLocal) return localYmd || cloudYmd;
  if (cloudYmd && localYmd && cloudYmd !== localYmd) return cloudYmd;
  return cloudYmd || localYmd;
}

checks.push(
  [pickMergedYmd("2026-10-28", "", false), "2026-10-28"],
  [pickMergedYmd("", "2026-10-28", false), "2026-10-28"],
  [pickMergedYmd("2026-10-30", "2026-10-28", false), "2026-10-30"],
  [pickMergedYmd("2026-10-30", "", true), "2026-10-30"],
  [pickMergedYmd("", "2026-10-28", true), "2026-10-28"],
);

let failed = 0;
for (const [got, expected] of checks) {
  if (got !== expected) {
    console.error("FAIL", { got, expected });
    failed += 1;
  }
}
if (failed > 0) process.exit(1);
console.log("verify-owner-tracking-next-contact: ok", { today, tomorrow, yesterday });
