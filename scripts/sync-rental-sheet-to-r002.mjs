#!/usr/bin/env node
/**
 * 試算表匯入案 → 負責人 R002，建立時間 = 開發日期
 * 用法：npm run sync:rental-sheet-r002
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  CLOUD_KEYS,
  loadWorkbook,
  normalizeOwnerTrackingStore,
  ownerCaseDedupeKey,
  upsertCloudPayload,
} from "./lib/spreadsheet-import-shared.mjs";
import { parseRentalTrackingFromWorkbook } from "./lib/rental-tracking-xlsx.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSIGNEE = "R002";

async function main() {
  const fallbacks = [
    process.argv[2],
    "/Users/zhangyouwei/Downloads/00-租賃追蹤表.xlsx",
    path.join(ROOT, "exports/owner-tracking.xlsx"),
  ].filter(Boolean);
  const filePath = fallbacks.find((p) => fs.existsSync(p));
  if (!filePath) {
    console.error("找不到 xlsx");
    process.exit(1);
  }

  const workbook = await loadWorkbook(filePath);
  const fromSheet = parseRentalTrackingFromWorkbook(workbook, ASSIGNEE);
  const sheetByDedupe = new Map(fromSheet.cases.map((c) => [ownerCaseDedupeKey(c), c]));

  const prisma = new PrismaClient();
  const row = await prisma.adminCloudData.findUnique({ where: { key: CLOUD_KEYS.ownerTracking } });
  if (!row?.payload) {
    console.error("雲端尚無 owner_tracking");
    process.exit(1);
  }

  const store = normalizeOwnerTrackingStore(row.payload);
  let assigned = 0;
  let dated = 0;

  for (const c of store.cases) {
    const sheetCase = sheetByDedupe.get(ownerCaseDedupeKey(c));
    const unassigned = !c.assignee.trim() || c.assignee.trim() === "—";

    if (sheetCase || unassigned) {
      if (c.assignee !== ASSIGNEE) {
        c.assignee = ASSIGNEE;
        assigned += 1;
      }
      if (sheetCase?.createdAt) {
        c.createdAt = sheetCase.createdAt;
        dated += 1;
      }
    }
  }

  const r002Ids = new Set(store.cases.filter((c) => c.assignee === ASSIGNEE).map((c) => c.id));
  for (const f of store.followUps) {
    if (r002Ids.has(f.caseId)) {
      if (!f.createdBy.trim() || f.createdBy.trim() === "—") f.createdBy = ASSIGNEE;
    }
  }

  const normalized = normalizeOwnerTrackingStore(store);
  await upsertCloudPayload(prisma, CLOUD_KEYS.ownerTracking, normalized);
  await prisma.$disconnect();

  const r002Total = normalized.cases.filter((c) => c.assignee === ASSIGNEE).length;
  console.log(`✓ ${filePath}`);
  console.log(`  雲端 ${normalized.cases.length} 案 · ${ASSIGNEE}：${r002Total} 案（改指派 ${assigned}、更新開發日期 ${dated}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
