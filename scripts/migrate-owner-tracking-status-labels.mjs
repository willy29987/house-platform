#!/usr/bin/env node
/**
 * 將雲端屋主追蹤追蹤紀錄的舊狀態字串改寫為現行選項（永久寫入 payload）：
 * - 同意委託 → 可上591
 * - 未接 → 持續聯繫
 * - 無效／重複 → 屋主已出租
 * - 已出租結案 → 屋主已出租
 * - 只可帶看、持續聯繫、可上591、屋主已出租：不變
 *
 *   node scripts/migrate-owner-tracking-status-labels.mjs
 *   node scripts/migrate-owner-tracking-status-labels.mjs --dry-run
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function migrateStore(store) {
  const normalized = normalizeOwnerTrackingStore(store);
  let changed = 0;
  const counts = {};
  const followUps = (normalized.followUps ?? []).map((f) => {
    const before = String(f.status ?? "").trim();
    const after = normalizeFollowUpStatus(before);
    if (before !== after) {
      changed += 1;
      counts[`${before} → ${after}`] = (counts[`${before} → ${after}`] || 0) + 1;
    }
    return before === after ? f : { ...f, status: after };
  });
  return {
    store: { cases: normalized.cases, followUps },
    changed,
    counts,
  };
}

async function main() {
  process.chdir(ROOT);
  const args = parseArgs(process.argv);
  if (!process.env.DATABASE_URL) {
    console.error("需要 DATABASE_URL");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const row = await prisma.adminCloudData.findUnique({ where: { key: CLOUD_KEYS.ownerTracking } });
    const store = row?.payload ?? { cases: [], followUps: [] };
    const { store: next, changed, counts } = migrateStore(store);

    console.log(`案件 ${next.cases.length} · 追蹤 ${next.followUps.length} · 改寫 ${changed} 筆狀態`);
    for (const [label, n] of Object.entries(counts).sort()) {
      console.log(`  ${label}: ${n}`);
    }

    if (changed === 0) {
      console.log("無需更新");
      return;
    }

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
