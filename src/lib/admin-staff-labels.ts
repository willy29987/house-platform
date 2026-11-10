/** 後台帳號：登入代號（R001）→ 顯示姓名 */

import { cache } from "react";

export type AdminStaffLabelEntry = {
  username: string;
  displayName: string | null;
};

/** 有姓名則顯示姓名，否則退回代號；未分配維持 — */
export function formatAdminStaffLabel(
  username: string | null | undefined,
  labelByUsername?: Record<string, string> | null,
): string {
  const raw = (username ?? "").trim();
  if (!raw || raw === "—") return "—";
  // 舊自抓資料曾寫成 system，顯示上等同 R001（Company）
  const key = raw.toLowerCase() === "system" ? "R001" : raw;
  const fromMap = labelByUsername?.[key]?.trim();
  if (fromMap) return fromMap;
  return key;
}

export function buildAdminStaffLabelMap(entries: AdminStaffLabelEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) {
    const u = e.username.trim();
    if (!u) continue;
    const name = (e.displayName ?? "").trim();
    if (name) map[u] = name;
  }
  return map;
}

/** 伺服端載入帳號姓名對照（失敗則空表；同 request 內去重） */
export const loadAdminStaffLabelMap = cache(async (): Promise<Record<string, string>> => {
  if (!process.env.DATABASE_URL) return {};
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.adminUser.findMany({
      select: { username: true, displayName: true },
      orderBy: { username: "asc" },
    });
    return buildAdminStaffLabelMap(rows);
  } catch (error) {
    console.error(
      "[db] loadAdminStaffLabelMap 失敗：",
      error instanceof Error ? error.message.trim().split("\n").pop() : error,
    );
    return {};
  }
});

/** 負責人篩選用帳號列表（同 request 內去重） */
export const listStaffUsernamesForAssigneeFilter = cache(async (): Promise<string[]> => {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.adminUser.findMany({
      select: { username: true },
      orderBy: { username: "asc" },
    });
    return rows.map((r) => r.username);
  } catch {
    return [];
  }
});
