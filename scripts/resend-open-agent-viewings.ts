/**
 * 補送尚未確認的約看給業務 LINE（awaiting_agent / pending_confirm）。
 * 用法：npx tsx scripts/resend-open-agent-viewings.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const { notifyAgentsOfNewViewing, getViewingAgentUserIds } = await import(
      "../src/lib/line-viewing-agent"
    );
    const agents = getViewingAgentUserIds();
    console.log("agents", agents.length);
    if (!agents.length) throw new Error("LINE_VIEWING_AGENT_USER_IDS empty");

    const row = await prisma.adminCloudData.findUnique({ where: { key: "line_rental_cases" } });
    const cases = ((row as { payload?: { cases?: unknown[] } } | null)?.payload?.cases ??
      []) as Array<{
      id: string;
      kind?: string;
      status?: string;
      displayName?: string;
      requestedWhen?: string;
      picked?: unknown[];
    }>;

    // 只補近 36 小時內建立／更新的，避免把舊案一次灌爆業務 LINE
    const sinceMs = Date.now() - 36 * 60 * 60 * 1000;
    const open = cases.filter((item) => {
      if (item.kind !== "viewing") return false;
      if (item.status !== "awaiting_agent" && item.status !== "pending_confirm") return false;
      if (!item.requestedWhen?.trim()) return false;
      if (!Array.isArray(item.picked) || !item.picked.length) return false;
      const createdAt = Date.parse(String((item as { createdAt?: string }).createdAt || 0));
      return Number.isFinite(createdAt) && createdAt >= sinceMs;
    });
    console.log("open viewings (last 36h)", open.length);

    for (const item of open) {
      const result = await notifyAgentsOfNewViewing(item as never);
      console.log(
        item.id,
        item.displayName,
        item.requestedWhen,
        `notified=${result.notified}`,
        result.failed.length ? `failed=${JSON.stringify(result.failed)}` : "ok",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
