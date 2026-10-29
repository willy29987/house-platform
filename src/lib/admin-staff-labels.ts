/** 後台帳號：登入代號（R001）→ 顯示姓名 */

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
  const fromMap = labelByUsername?.[raw]?.trim();
  if (fromMap) return fromMap;
  return raw;
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

/** 伺服端載入帳號姓名對照（失敗則空表） */
export async function loadAdminStaffLabelMap(): Promise<Record<string, string>> {
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
}
