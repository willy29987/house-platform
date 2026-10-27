#!/usr/bin/env node
/**
 * 校準屋主追蹤「目前狀態」：
 * - 可上591：總表等案件備註 591＝O
 * - 只可帶看：僅「可帶看總表」分頁列出的案件（不用總表 591＝X）
 *
 *   node scripts/recalibrate-owner-tracking-591-status.mjs --file ~/Downloads/00-租賃追蹤表.xlsx
 *   node scripts/recalibrate-owner-tracking-591-status.mjs --file ... --dry-run
 */
import fs from "node:fs";
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
  collectViewOnlyDedupeKeysFromWorkbook,
  extract591FromCaseNote,
  statusFrom591Cell,
} from "./lib/rental-tracking-xlsx.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_STATUSES = new Set(["屋主已出租", "已出租結案"]);
const DEFAULT_XLSX = path.join(process.env.HOME ?? "", "Downloads", "00-租賃追蹤表.xlsx");

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

/** @returns {string | null} 目標狀態；null 表示不必改 */
function resolveTargetStatus(c, viewOnlyKeys) {
  const dk = ownerCaseDedupeKey(c);
  if (viewOnlyKeys.has(dk)) return "只可帶看";
  const entrust = statusFrom591Cell(extract591FromCaseNote(c.caseNote));
  if (entrust === "可上591") return "可上591";
  return null;
}

function applyCalibration(store, viewOnlyKeys) {
  const followUps = [...(store.followUps ?? [])];
  let updated = 0;
  let skippedFinal = 0;
  let clearedWrongViewOnly = 0;
  let setViewOnly = 0;
  let setEntrust = 0;

  for (const c of store.cases ?? []) {
    let target = resolveTargetStatus(c, viewOnlyKeys);
    const idx = latestFollowUpIndex(followUps, c.id);

    if (idx >= 0) {
      const fu = followUps[idx];
      if (SKIP_STATUSES.has(fu.status)) {
        skippedFinal += 1;
        continue;
      }
      if (!target && fu.status === "只可帶看") {
        target = "持續聯繫";
        clearedWrongViewOnly += 1;
      }
      if (!target) continue;
      target = normalizeFollowUpStatus(target);
      if (fu.status === target) continue;
      followUps[idx] = {
        ...fu,
        status: target,
        note: fu.note?.includes("591") || fu.note?.includes("可帶看總表")
          ? fu.note
          : [fu.note, target === "只可帶看" ? "依可帶看總表校準" : "依 591 欄校準"].filter(Boolean).join(" · "),
      };
      updated += 1;
      if (target === "只可帶看") setViewOnly += 1;
      if (target === "可上591") setEntrust += 1;
      continue;
    }

    if (!target) continue;
    target = normalizeFollowUpStatus(target);
    followUps.push({
      id: newImportId("fu"),
      caseId: c.id,
      status: target,
      note: target === "只可帶看" ? "依可帶看總表校準" : "依 591 欄校準",
      createdBy: c.assignee || "—",
      createdAt: new Date().toISOString(),
    });
    updated += 1;
    if (target === "只可帶看") setViewOnly += 1;
    if (target === "可上591") setEntrust += 1;
  }

  return {
    store: normalizeOwnerTrackingStore({ cases: store.cases ?? [], followUps }),
    updated,
    skippedFinal,
    clearedWrongViewOnly,
    setViewOnly,
    setEntrust,
    viewOnlyKeyCount: viewOnlyKeys.size,
  };
}

async function main() {
  process.chdir(ROOT);
  const args = parseArgs(process.argv);
  if (!process.env.DATABASE_URL) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }

  const filePath = path.resolve(
    args.file || (fs.existsSync(DEFAULT_XLSX) ? DEFAULT_XLSX : ""),
  );
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("請指定 --file（例如 Downloads/00-租賃追蹤表.xlsx）");
    process.exit(1);
  }

  const workbook = await loadWorkbook(filePath);
  const viewOnlyKeys = collectViewOnlyDedupeKeysFromWorkbook(workbook);
  console.log(`可帶看總表：${viewOnlyKeys.size} 案（${path.basename(filePath)}）`);

  const prisma = new PrismaClient();
  try {
    const row = await prisma.adminCloudData.findUnique({ where: { key: CLOUD_KEYS.ownerTracking } });
    const store = normalizeOwnerTrackingStore(row?.payload ?? { cases: [], followUps: [] });
    const { store: next, updated, skippedFinal, clearedWrongViewOnly, setViewOnly, setEntrust } =
      applyCalibration(store, viewOnlyKeys);

    console.log(
      `案件 ${next.cases.length} · 追蹤 ${next.followUps.length} · 更新 ${updated} 筆（只可帶看 ${setViewOnly}、可上591 ${setEntrust}、移除誤標只可帶看 ${clearedWrongViewOnly}）· 略過結案 ${skippedFinal}`,
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
