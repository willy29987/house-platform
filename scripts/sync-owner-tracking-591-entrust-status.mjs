#!/usr/bin/env node
/**
 * 將「可上591」篩選涵蓋的案件（最新狀態可上591，或備註 591:O、且非屋主已出租）
 * 若目前狀態不是可上591，追加一筆追蹤把狀態改成可上591。
 *
 * 用法：node scripts/sync-owner-tracking-591-entrust-status.mjs
 * 預覽：node scripts/sync-owner-tracking-591-entrust-status.mjs --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { normalizeOwnerTrackingStore } from "./lib/spreadsheet-import-shared.mjs";

const KEY = "owner_tracking";
const dryRun = process.argv.includes("--dry-run");

function extract591FromCaseNote(caseNote) {
  const m = String(caseNote ?? "").match(/591[：:]\s*([^；\n]+)/);
  return m ? m[1].trim() : "";
}

function is591EntrustCaseNote(caseNote) {
  const token = extract591FromCaseNote(caseNote).toUpperCase().split(/[\/／、,，\s]+/)[0];
  if (!token) return false;
  return token === "O" || token === "○" || token === "〇" || token === "是" || token === "Y";
}

function normalizeFollowUpStatus(status) {
  const legacy = {
    同意委託: "可上591",
    已出租結案: "屋主已出租",
    "無效／重複": "屋主已出租",
    無效: "屋主已出租",
    待上591: "可上591",
    已上591: "可上591",
  };
  const t = String(status ?? "").trim();
  if (legacy[t]) return legacy[t];
  if (["持續聯繫", "只可帶看", "可上591", "屋主已出租"].includes(t)) return t;
  return "持續聯繫";
}

function lastFollowUp(followUps, caseId) {
  const list = followUps.filter((f) => f.caseId === caseId);
  if (!list.length) return null;
  return list.sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  })[0];
}

function effectiveStatus(c, followUps) {
  const last = lastFollowUp(followUps, c.id);
  if (last) return normalizeFollowUpStatus(last.status);
  if (is591EntrustCaseNote(c.caseNote)) return "可上591";
  return "持續聯繫";
}

function matches可上591Filter(c, followUps) {
  const eff = effectiveStatus(c, followUps);
  if (eff === "可上591") return true;
  if (eff !== "屋主已出租" && is591EntrustCaseNote(c.caseNote)) return true;
  return false;
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const p = new PrismaClient();
try {
  const row = await p.adminCloudData.findUnique({ where: { key: KEY } });
  const raw = typeof row?.payload === "string" ? JSON.parse(row.payload) : row?.payload;
  const store = normalizeOwnerTrackingStore(raw);
  const followUps = [...store.followUps];
  const nowIso = new Date().toISOString();
  const updated = [];

  for (const c of store.cases) {
    if (!matches可上591Filter(c, followUps)) continue;
    const from = effectiveStatus(c, followUps);
    if (from === "可上591") continue;
    followUps.push({
      id: newId("fu"),
      caseId: c.id,
      status: "可上591",
      note: "系統：依備註 591:O／可上591 清單同步狀態",
      createdBy: "system",
      createdAt: nowIso,
    });
    updated.push({
      id: c.id.slice(-10),
      owner: c.ownerName,
      assignee: c.assignee,
      from,
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        matchedNeedingUpdate: updated.length,
        updated,
      },
      null,
      2,
    ),
  );

  if (!dryRun && updated.length > 0) {
    const next = normalizeOwnerTrackingStore({ cases: store.cases, followUps });
    await p.adminCloudData.upsert({
      where: { key: KEY },
      create: { key: KEY, payload: next },
      update: { payload: next },
    });
    console.log(`wrote ${updated.length} follow-up(s) to cloud`);
  }
} finally {
  await p.$disconnect();
}
