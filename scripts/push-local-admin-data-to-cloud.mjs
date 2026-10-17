#!/usr/bin/env node
/**
 * 從 Cursor 內嵌瀏覽器（或複製的 LevelDB）讀取 localStorage，
 * 寫入 Supabase AdminCloudData（與 Vercel 後台共用）。
 *
 * 用法：node scripts/push-local-admin-data-to-cloud.mjs
 */
import { Level } from "level";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "";

const LEVELDB_DIRS = [
  path.join(
    HOME,
    "Library/Application Support/Cursor/Partitions/cursor-7bc1de7208d4d5942b31e081efd94442-browser/Local Storage/leveldb",
  ),
  path.join(HOME, "Library/Application Support/Cursor/Partitions/cursor-browser/Local Storage/leveldb"),
];

const LS_TO_CLOUD = {
  "house-platform:owner-tracking-preview:v4": "owner_tracking",
  "house-platform:commission-stats:v1": "commission_records",
  "house-platform:tenant-manager:v1": "tenant_manager",
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
    /* utf8 非 JSON，試 UTF-16 LE（Chrome 常見：前導 0x00 + 0x7b） */
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

async function readAllFromLevelDb(dir) {
  const found = {};
  if (!fs.existsSync(dir)) return found;

  const tmp = fs.mkdtempSync(path.join("/tmp", "hp-ls-"));
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
  fs.rmSync(tmp, { recursive: true, force: true });
  return found;
}

function countPayload(key, payload) {
  if (key === "owner_tracking" && payload && typeof payload === "object") {
    return `${payload.cases?.length ?? 0} cases, ${payload.followUps?.length ?? 0} followUps`;
  }
  if (key === "commission_records" && Array.isArray(payload)) return `${payload.length} records`;
  if (key === "tenant_manager" && payload && typeof payload === "object") {
    return `${payload.tenants?.length ?? 0} tenants`;
  }
  return "ok";
}

async function main() {
  process.chdir(ROOT);
  const merged = {};
  for (const dir of LEVELDB_DIRS) {
    Object.assign(merged, await readAllFromLevelDb(dir));
  }

  const prisma = new PrismaClient();
  let wrote = 0;

  for (const [lsKey, cloudKey] of Object.entries(LS_TO_CLOUD)) {
    const raw = merged[lsKey];
    if (!raw) {
      console.log(`⏭ ${cloudKey}：本機無 ${lsKey}`);
      continue;
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      console.error(`✗ ${cloudKey}：JSON 解析失敗`, e.message);
      continue;
    }

    const empty =
      cloudKey === "owner_tracking"
        ? !(payload.cases?.length || payload.followUps?.length)
        : cloudKey === "commission_records"
          ? !Array.isArray(payload) || payload.length === 0
          : !(payload.tenants?.length || Object.keys(payload.rent ?? {}).length);

    if (empty) {
      console.log(`⏭ ${cloudKey}：本機為空，略過`);
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
    console.log("\n沒有可上傳的非空資料。若你用 Chrome 開 localhost，請先在該瀏覽器開後台再重跑。");
    process.exit(1);
  }
  console.log("\n完成。Vercel 登入後台重新整理即可看到相同資料。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
