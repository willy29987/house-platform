#!/usr/bin/env node
/**
 * 依試算表 591 欄（O＝同意委託、X＝只可帶看）校準屋主追蹤「目前狀態」（最新一筆追蹤）。
 *
 *   node scripts/recalibrate-owner-tracking-591-status.mjs --dry-run
 *   node scripts/recalibrate-owner-tracking-591-status.mjs
 *   node scripts/recalibrate-owner-tracking-591-status.mjs --file exports/owner-tracking.xlsx
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  CLOUD_KEYS,
  loadWorkbook,
  newImportId,
  normalizeFollowUpStatus,
  normalizeOwnerTrackingStore,
  ownerCaseDedupeKey,
  upsertCloudPayload,
} from "./lib/spreadsheet-import-shared.mjs";
import {
  extract591FromCaseNote,
  parseRentalTrackingFromWorkbook,
  statusFrom591Cell,
} from "./lib/rental-tracking-xlsx.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_STATUSES = new Set(["已出租結案", "無效／重複"]);

function parseArgs(argv) {
  const out = { dryRun: false, file: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--file") out.file = argv[++i] ?? "";
  }
  return out;
}

function latestFollowUpIndex(followUps, caseId) {
  let best = -1;
  let bestAt = "";
  for (let i = 0; i < followUps.length; i++) {
    const f = followUps[i];
    if (f.caseId !== caseId) continue;
    if (!bestAt || f.createdAt.localeCompare(bestAt) > 0) {
      bestAt = f.createdAt;
      best = i;
    }
  }
  return best;
}

function build591MapFromWorkbook(workbook, defaultAssignee) {
  const incoming = parseRentalTrackingFromWorkbook(workbook, defaultAssignee);
  const map = new Map();
  for (const c of incoming.cases) {
    const raw = extract591FromCaseNote(c.caseNote);
    const status = statusFrom591Cell(raw);
    if (!status) continue;
    map.set(ownerCaseDedupeKey(c), status);
  }
  return map;
}

function targetStatusForCase(c, mapFromFile) {
  if (mapFromFile?.size) {
    const fromFile = mapFromFile.get(ownerCaseDedupeKey(c));
    if (fromFile) return fromFile;
  }
  const raw = extract591FromCaseNote(c.caseNote);
  return statusFrom591Cell(raw);
}

function applyCalibration(store, mapFromFile) {
  const followUps = [...(store.followUps ?? [])];
  let updated = 0;
  let skippedFinal = 0;
  let no591 = 0;

  for (const c of store.cases ?? []) {
    const rawTarget = targetStatusForCase(c, mapFromFile);
    if (!rawTarget) {
      no591 += 1;
      continue;
    }
    const target = normalizeFollowUpStatus(rawTarget);

    const idx = latestFollowUpIndex(followUps, c.id);
    if (idx >= 0) {
      const fu = followUps[idx];
      if (SKIP_STATUSES.has(fu.status)) {
        skippedFinal += 1;
        continue;
      }
      if (fu.status === target) continue;
      followUps[idx] = {
        ...fu,
        status: target,
        note: fu.note?.includes("591") ? fu.note : [fu.note, "依 591 欄校準"].filter(Boolean).join(" · "),
      };
      updated += 1;
      continue;
    }

    followUps.push({
      id: newImportId("fu"),
      caseId: c.id,
      status: target,
      note: "依 591 欄校準",
      createdBy: c.assignee || "—",
      createdAt: new Date().toISOString(),
    });
    updated += 1;
  }

  return {
    store: normalizeOwnerTrackingStore({ cases: store.cases ?? [], followUps }),
    updated,
    skippedFinal,
    no591,
  };
}

async function main() {
  process.chdir(ROOT);
  const args = parseArgs(process.argv);
  if (!process.env.DATABASE_URL) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }

  let mapFromFile = null;
  if (args.file) {
    const filePath = path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file);
    const workbook = await loadWorkbook(filePath);
    mapFromFile = build591MapFromWorkbook(workbook, "R002");
    console.log(`檔案 591 對照：${mapFromFile.size} 筆`);
  }

  const prisma = new PrismaClient();
  try {
    const row = await prisma.adminCloudData.findUnique({ where: { key: CLOUD_KEYS.ownerTracking } });
    const store = normalizeOwnerTrackingStore(row?.payload ?? { cases: [], followUps: [] });
    const { store: next, updated, skippedFinal, no591 } = applyCalibration(store, mapFromFile);

    console.log(
      `案件 ${next.cases.length} · 追蹤 ${next.followUps.length} · 校準 ${updated} 筆 · 略過結案 ${skippedFinal} · 無 591 ${no591}`,
    );

    if (!args.dryRun) {
      await upsertCloudPayload(prisma, CLOUD_KEYS.ownerTracking, next);
      console.log("✓ 已寫入 Supabase owner_tracking");
    } else {
      console.log("（dry-run，未寫入）");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
