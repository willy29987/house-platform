#!/usr/bin/env node
/**
 * 依案件備註 591:O 將「目前應為可上591」的案件，最新追蹤狀態改寫為可上591
 * （略過最新已是只可帶看／屋主已出租／可上591）
 *
 *   node scripts/sync-owner-tracking-591-entrust-status.mjs
 *   node scripts/sync-owner-tracking-591-entrust-status.mjs --dry-run
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  CLOUD_KEYS,
  normalizeFollowUpStatus,
  normalizeOwnerTrackingStore,
  upsertCloudPayload,
} from "./lib/spreadsheet-import-shared.mjs";
import { statusFrom591Cell, extract591FromCaseNote } from "./lib/rental-tracking-xlsx.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["只可帶看", "屋主已出租", "可上591"]);

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

function apply(store) {
  const followUps = [...(store.followUps ?? [])];
  let updated = 0;
  for (const c of store.cases ?? []) {
    if (statusFrom591Cell(extract591FromCaseNote(c.caseNote)) !== "可上591") continue;
    const idx = latestFollowUpIndex(followUps, c.id);
    if (idx < 0) continue;
    const fu = followUps[idx];
    const cur = normalizeFollowUpStatus(fu.status);
    if (SKIP.has(cur)) continue;
    followUps[idx] = {
      ...fu,
      status: "可上591",
      note: fu.note?.includes("591") ? fu.note : [fu.note, "依 591:O 同步為可上591"].filter(Boolean).join(" · "),
    };
    updated += 1;
  }
  return { store: normalizeOwnerTrackingStore({ cases: store.cases ?? [], followUps }), updated };
}

async function main() {
  process.chdir(ROOT);
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.DATABASE_URL) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const row = await prisma.adminCloudData.findUnique({ where: { key: CLOUD_KEYS.ownerTracking } });
    const store = row?.payload ?? { cases: [], followUps: [] };
    const { store: next, updated } = apply(store);
    console.log(`案件 ${next.cases.length} · 更新最新追蹤為可上591：${updated} 筆`);
    if (updated > 0 && !dryRun) {
      await upsertCloudPayload(prisma, CLOUD_KEYS.ownerTracking, next);
      console.log("✓ 已寫入 Supabase owner_tracking");
    } else if (dryRun) {
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
