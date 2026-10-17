#!/usr/bin/env node
/**
 * 從本機所有瀏覽器 LevelDB 讀取 house-platform localStorage，
 * 合併後寫入 Supabase AdminCloudData；服務費若本機為空則從成交物件回填。
 *
 * 用法：npm run push:local-admin-data
 */
import { Level } from "level";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "";
const META_PREFIX = "__listing_meta__:";

const CLOUD_KEYS = {
  ownerTracking: "owner_tracking",
  commissionRecords: "commission_records",
  tenantManager: "tenant_manager",
};

/** @type {Record<string, string>} localStorage key → cloud key */
const LS_PREFIX_TO_CLOUD = {
  "house-platform:owner-tracking-preview:": CLOUD_KEYS.ownerTracking,
  "house-platform:commission-stats:": CLOUD_KEYS.commissionRecords,
  "house-platform:tenant-manager:": CLOUD_KEYS.tenantManager,
};

function decodeChromeLocalValue(buf) {
  if (!buf?.length) return "";
  if (buf[0] === 0x01) return decodeChromeLocalValue(buf.subarray(1));

  const tryParse = (s) => {
    const t = s.replace(/^\uFEFF/, "").replace(/\0/g, "").trim();
    JSON.parse(t);
    return t;
  };

  try {
    return tryParse(buf.toString("utf8"));
  } catch {
    /* utf16 */
  }

  for (const sliceStart of [1, 0, 2]) {
    if (sliceStart >= buf.length) continue;
    try {
      return tryParse(buf.subarray(sliceStart).toString("utf16le"));
    } catch {
      /* next */
    }
  }

  return buf.toString("utf8");
}

function storageKeyFromLevelKey(keyBuf) {
  const ks = keyBuf.toString("utf8");
  const idx = ks.indexOf("\u0001");
  if (idx >= 0) return ks.slice(idx + 1);
  return ks;
}

function discoverLevelDbDirs() {
  const roots = [
    path.join(HOME, "Library/Application Support/Google/Chrome"),
    path.join(HOME, "Library/Application Support/Cursor/Partitions"),
    path.join(HOME, "Library/Application Support/Microsoft Edge"),
    path.join(HOME, "Library/Application Support/Arc/User Data"),
  ];
  const dirs = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.endsWith(`${path.sep}Local Storage${path.sep}leveldb`)) {
        dirs.add(cur);
        continue;
      }
      let entries;
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        stack.push(path.join(cur, e.name));
      }
    }
  }
  return [...dirs];
}

async function readAllFromLevelDb(dir) {
  const found = {};
  if (!fs.existsSync(dir)) return found;

  const tmp = fs.mkdtempSync(path.join("/tmp", "hp-ls-"));
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".ldb") || f.startsWith("MANIFEST") || f === "CURRENT") {
        fs.copyFileSync(path.join(dir, f), path.join(tmp, f));
      }
    }

    const db = new Level(tmp, { createIfMissing: false, keyEncoding: "buffer", valueEncoding: "buffer" });
    for await (const [key, value] of db.iterator()) {
      const short = storageKeyFromLevelKey(key);
      if (!short.startsWith("house-platform:")) continue;
      const decoded = decodeChromeLocalValue(value);
      if (!found[short] || decoded.length > found[short].length) {
        found[short] = decoded;
      }
    }
    await db.close();
  } catch {
    /* locked or corrupt */
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return found;
}

function cloudKindForLsKey(lsKey) {
  for (const [prefix, cloudKey] of Object.entries(LS_PREFIX_TO_CLOUD)) {
    if (lsKey.startsWith(prefix)) return cloudKey;
  }
  return null;
}

function parseJsonSafe(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mergeOwnerTracking(...stores) {
  const casesById = new Map();
  const followById = new Map();
  for (const s of stores) {
    if (!s || typeof s !== "object") continue;
    for (const c of s.cases ?? []) {
      if (c?.id) casesById.set(c.id, c);
    }
    for (const f of s.followUps ?? []) {
      if (f?.id) followById.set(f.id, f);
    }
  }
  return {
    cases: [...casesById.values()],
    followUps: [...followById.values()],
  };
}

function mergeCommissionRecords(...arrays) {
  const byId = new Map();
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (r?.id) byId.set(r.id, r);
      else if (r?.listingId) byId.set(`listing:${r.listingId}`, r);
    }
  }
  return [...byId.values()];
}

function mergeTenantManager(...stores) {
  const tenantsById = new Map();
  const rent = {};
  const utility = {};
  for (const s of stores) {
    if (!s || typeof s !== "object") continue;
    for (const t of s.tenants ?? []) {
      if (t?.id) tenantsById.set(t.id, t);
    }
    Object.assign(rent, s.rent ?? {});
    Object.assign(utility, s.utility ?? {});
  }
  return { tenants: [...tenantsById.values()], rent, utility };
}

function parseListingMeta(description) {
  if (!description) return {};
  const i = description.indexOf(META_PREFIX);
  if (i < 0) return {};
  const tail = description.slice(i + META_PREFIX.length);
  const line = tail.split("\n")[0];
  try {
    return JSON.parse(line);
  } catch {
    return {};
  }
}

function suggestCommissionAmount(dealAmount, serviceFeeText, listingType) {
  if (dealAmount <= 0) return 0;
  if (listingType === "SALE") return 0;
  const t = (serviceFeeText ?? "").trim();
  if (!t || t === "無") return 0;
  if (t === "正常") return Math.round(dealAmount);
  if (t === "半個月") return Math.round(dealAmount / 2);
  const digits = t.replace(/[^\d.]/g, "");
  const n = Number(digits);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 0;
}

function commissionFromListing(listing, meta) {
  const dealAmount = listing.price ?? 0;
  const listingType = listing.listingType;
  const addressLine = `${listing.city}${listing.district}${listing.address ?? ""}`.trim();
  const noteParts = [
    listing.community?.trim() ? `社區：${listing.community.trim()}` : null,
    addressLine ? `地址：${addressLine}` : null,
    `刊登 #${listing.id}`,
    meta.serviceFee?.trim() ? `約定服務費：${meta.serviceFee.trim()}` : null,
    meta.unpublishCategory === "DEAL" ? "（由成交物件回填）" : null,
  ].filter(Boolean);

  const unpublishedAt = meta.unpublishedAt ?? listing.updatedAt?.toISOString?.() ?? new Date().toISOString();
  const date = unpublishedAt.slice(0, 10);

  return {
    id: `backfill-listing-${listing.id}`,
    date,
    title: listing.title.trim(),
    listingType,
    operator: meta.createdByUsername?.trim() ?? "",
    client: listing.contactName?.trim() ?? "",
    dealAmount,
    commission: suggestCommissionAmount(dealAmount, meta.serviceFee, listingType),
    received: true,
    note: noteParts.join("\n"),
    createdAt: unpublishedAt,
    listingId: listing.id,
  };
}

async function backfillCommissionFromListings(prisma, existing) {
  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      title: true,
      price: true,
      listingType: true,
      description: true,
      contactName: true,
      city: true,
      district: true,
      address: true,
      community: true,
      isPublished: true,
      updatedAt: true,
    },
  });

  const backfill = [];
  for (const l of listings) {
    const meta = parseListingMeta(l.description);
    if (meta.unpublishCategory === "PAUSE" || meta.unpublishCategory === "OTHER") continue;
    const isDeal =
      meta.unpublishCategory === "DEAL" ||
      (!l.isPublished && Boolean(meta.expectedReleaseDate?.trim()));
    if (!isDeal) continue;
    backfill.push(commissionFromListing(l, meta));
  }

  return mergeCommissionRecords(existing, backfill);
}

function countPayload(key, payload) {
  if (key === CLOUD_KEYS.ownerTracking && payload && typeof payload === "object") {
    return `${payload.cases?.length ?? 0} cases, ${payload.followUps?.length ?? 0} followUps`;
  }
  if (key === CLOUD_KEYS.commissionRecords && Array.isArray(payload)) return `${payload.length} records`;
  if (key === CLOUD_KEYS.tenantManager && payload && typeof payload === "object") {
    return `${payload.tenants?.length ?? 0} tenants`;
  }
  return "ok";
}

function isEmptyPayload(key, payload) {
  if (key === CLOUD_KEYS.ownerTracking) {
    return !(payload?.cases?.length || payload?.followUps?.length);
  }
  if (key === CLOUD_KEYS.commissionRecords) {
    return !Array.isArray(payload) || payload.length === 0;
  }
  if (key === CLOUD_KEYS.tenantManager) {
    return !(payload?.tenants?.length || Object.keys(payload?.rent ?? {}).length);
  }
  return true;
}

async function main() {
  process.chdir(ROOT);

  const dirs = discoverLevelDbDirs();
  console.log(`掃描 ${dirs.length} 個瀏覽器 Local Storage…`);

  const mergedRaw = {};
  for (const dir of dirs) {
    const part = await readAllFromLevelDb(dir);
    for (const [lsKey, raw] of Object.entries(part)) {
      if (!mergedRaw[lsKey] || raw.length > mergedRaw[lsKey].length) {
        mergedRaw[lsKey] = raw;
      }
    }
  }

  const ownerLocals = [];
  const commissionLocals = [];
  const tenantLocals = [];

  for (const [lsKey, raw] of Object.entries(mergedRaw)) {
    const kind = cloudKindForLsKey(lsKey);
    const parsed = parseJsonSafe(raw);
    if (!kind || parsed == null) continue;
    if (kind === CLOUD_KEYS.ownerTracking) ownerLocals.push(parsed);
    if (kind === CLOUD_KEYS.commissionRecords) commissionLocals.push(parsed);
    if (kind === CLOUD_KEYS.tenantManager) tenantLocals.push(parsed);
  }

  const prisma = new PrismaClient();
  const existingRows = await prisma.adminCloudData.findMany();
  const existing = Object.fromEntries(existingRows.map((r) => [r.key, r.payload]));

  let ownerPayload = mergeOwnerTracking(existing[CLOUD_KEYS.ownerTracking], ...ownerLocals);
  let commissionPayload = mergeCommissionRecords(
    existing[CLOUD_KEYS.commissionRecords],
    ...commissionLocals,
  );
  commissionPayload = await backfillCommissionFromListings(prisma, commissionPayload);
  const tenantPayload = mergeTenantManager(existing[CLOUD_KEYS.tenantManager], ...tenantLocals);

  const toWrite = [
    [CLOUD_KEYS.ownerTracking, ownerPayload],
    [CLOUD_KEYS.commissionRecords, commissionPayload],
    [CLOUD_KEYS.tenantManager, tenantPayload],
  ];

  let wrote = 0;
  for (const [cloudKey, payload] of toWrite) {
    if (isEmptyPayload(cloudKey, payload)) {
      console.log(`⏭ ${cloudKey}：無資料可寫`);
      continue;
    }
    await prisma.adminCloudData.upsert({
      where: { key: cloudKey },
      create: { key: cloudKey, payload },
      update: { payload },
    });
    console.log(`✓ ${cloudKey} → Supabase（${countPayload(cloudKey, payload)}）`);
    wrote += 1;
  }

  await prisma.$disconnect();

  if (!wrote) {
    console.log("\n沒有可上傳的資料。");
    process.exit(1);
  }
  console.log("\n完成。請在 Vercel 後台重新整理（服務費、屋主追蹤、房客）。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
