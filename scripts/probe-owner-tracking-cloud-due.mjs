#!/usr/bin/env node
/** 雲端 owner_tracking 聯繫日統計 + 模擬「改為今日」後 DUE 筆數（不寫入 DB） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const TAIPEI_TZ = "Asia/Taipei";
const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".cursor", "debug-8e3c3f.log");

function taipeiTodayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TAIPEI_TZ });
}

function dueCount(cases, today) {
  let n = 0;
  for (const c of cases) {
    const ymd = String(c.nextContactDate ?? "").trim();
    if (ymd && ymd <= today) n += 1;
  }
  return n;
}

const p = new PrismaClient();
const today = taipeiTodayYmd();
const row = await p.adminCloudData.findUnique({ where: { key: "owner_tracking" } });
const store = typeof row?.payload === "string" ? JSON.parse(row.payload) : row?.payload;
const cases = store?.cases ?? [];
const withDate = cases.filter((c) => String(c.nextContactDate ?? "").trim()).length;
const due = dueCount(cases, today);

const simulated = cases.map((c, i) =>
  i === 0 && cases.length ? { ...c, nextContactDate: today } : c,
);
const dueAfterSimulatedPatch = dueCount(simulated, today);

const entry = {
  sessionId: "8e3c3f",
  runId: "post-fix-cloud-probe",
  hypothesisId: "H2-H6",
  location: "probe-owner-tracking-cloud-due.mjs",
  message: "cloud due snapshot + simulated patch",
  data: {
    taipeiToday: today,
    totalCases: cases.length,
    withNextContactDate: withDate,
    dueTodayOrOverdue: due,
    dueAfterSimulatedFirstCasePatchedToToday: dueAfterSimulatedPatch,
  },
  timestamp: Date.now(),
};

try {
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
} catch (e) {
  console.error("log write failed", e.message);
}
console.log(JSON.stringify(entry.data, null, 2));
await p.$disconnect();
