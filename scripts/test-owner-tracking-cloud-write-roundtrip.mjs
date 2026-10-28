#!/usr/bin/env node
/** 驗證雲端 write + normalize 保留 nextContactDate（寫入今日後還原） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { normalizeOwnerTrackingStore } from "./lib/spreadsheet-import-shared.mjs";

const LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".cursor", "debug-8e3c3f.log");
const KEY = "owner_tracking";

function taipeiTodayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function dueCount(cases, today) {
  let n = 0;
  for (const c of cases) {
    const ymd = String(c.nextContactDate ?? "").trim();
    if (ymd && ymd <= today) n += 1;
  }
  return n;
}

function patchCaseYmd(store, caseId, ymd) {
  return normalizeOwnerTrackingStore({
    ...store,
    cases: store.cases.map((c) => (c.id === caseId ? { ...c, nextContactDate: ymd } : c)),
  });
}

async function readStore(p) {
  const row = await p.adminCloudData.findUnique({ where: { key: KEY } });
  const raw = typeof row?.payload === "string" ? JSON.parse(row.payload) : row?.payload;
  return normalizeOwnerTrackingStore(raw);
}

async function writeStore(p, store) {
  const normalized = normalizeOwnerTrackingStore(store);
  await p.adminCloudData.upsert({
    where: { key: KEY },
    create: { key: KEY, payload: normalized },
    update: { payload: normalized },
  });
}

const p = new PrismaClient();
const today = taipeiTodayYmd();
try {
  const before = await readStore(p);
  const target = before.cases.find((c) => String(c.nextContactDate ?? "").trim() === "2026-10-30");
  if (!target) throw new Error("no case with 2026-10-30 to test");
  const originalYmd = String(target.nextContactDate).trim();

  await writeStore(p, patchCaseYmd(before, target.id, today));
  const mid = await readStore(p);
  const midCase = mid.cases.find((c) => c.id === target.id);
  const dueMid = dueCount(mid.cases, today);

  await writeStore(p, patchCaseYmd(mid, target.id, originalYmd));
  const after = await readStore(p);
  const afterCase = after.cases.find((c) => c.id === target.id);
  const dueAfter = dueCount(after.cases, today);

  const entry = {
    sessionId: "8e3c3f",
    runId: "post-fix-write-roundtrip",
    hypothesisId: "H7",
    location: "test-owner-tracking-cloud-write-roundtrip.mjs",
    message: "cloud write roundtrip ok",
    data: {
      taipeiToday: today,
      caseId: target.id.slice(-8),
      originalYmd,
      midYmd: midCase?.nextContactDate,
      dueMid,
      revertedYmd: afterCase?.nextContactDate,
      dueAfter,
    },
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
  console.log(JSON.stringify(entry.data, null, 2));
  if (midCase?.nextContactDate !== today || dueMid < 1) process.exit(1);
  if (afterCase?.nextContactDate !== originalYmd) process.exit(1);
} finally {
  await p.$disconnect();
}
