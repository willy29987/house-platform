/**
 * 刪除「從未上架過」的草稿房源（isPublished=false 且無 unpublishedAt）。
 * 不刪除已下架／即將釋出等有下架紀錄的物件。
 *
 *   node scripts/delete-never-published-listing-drafts.mjs
 *   node scripts/delete-never-published-listing-drafts.mjs --dry-run
 */

import { PrismaClient } from "@prisma/client";

const LISTING_META_PREFIX = "__listing_meta__:";

function parseMeta(description) {
  if (!description?.startsWith(LISTING_META_PREFIX)) return {};
  try {
    return JSON.parse(description.slice(LISTING_META_PREFIX.length));
  } catch {
    return {};
  }
}

function isUpcomingRelease(isPublished, expectedReleaseDate) {
  if (isPublished) return false;
  if (!expectedReleaseDate) return false;
  const release = new Date(expectedReleaseDate);
  if (!Number.isFinite(release.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const releaseDay = new Date(release.getFullYear(), release.getMonth(), release.getDate());
  const days = Math.round((releaseDay - startOfToday) / (24 * 60 * 60 * 1000));
  return days >= 0 && days <= 60;
}

function isNeverPublishedDraft(row, meta) {
  if (row.isPublished) return false;
  if (isUpcomingRelease(row.isPublished, meta.expectedReleaseDate)) return false;
  return !meta.unpublishedAt;
}

const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.listing.findMany({
    select: { id: true, title: true, isPublished: true, description: true, createdAt: true },
  });
  const toDelete = rows.filter((r) => isNeverPublishedDraft(r, parseMeta(r.description)));
  console.log(`Found ${toDelete.length} never-published draft(s) of ${rows.length} total listings`);
  for (const r of toDelete) {
    console.log(`  - ${r.id}  ${r.title || "(無標題)"}  ${r.createdAt.toISOString().slice(0, 10)}`);
  }
  if (dryRun) {
    console.log("Dry run — no rows deleted.");
  } else if (toDelete.length > 0) {
    const ids = toDelete.map((r) => r.id);
    const result = await prisma.listing.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${result.count} listing(s).`);
  }
} finally {
  await prisma.$disconnect();
}
