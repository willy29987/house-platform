import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getTeamMember } from "@/lib/ai-team-data";
import { getWorkerIdsForDepth, type OrchestrateDepth } from "@/lib/ai-team-orchestrate";
import { generateText, getAIConfig, loadSystemPrompt } from "@/lib/ai-team-server";

const orchestrateSchema = z.object({
  goal: z.string().min(5),
  depth: z.enum(["quick", "standard", "full"]).default("quick"),
  allowUpgrade: z.boolean().optional(),
});

function isUltraSavingModeEnabled(): boolean {
  const raw = (process.env.AI_ULTRA_SAVING_MODE || "1").toLowerCase().trim();
  return !["0", "false", "off", "no"].includes(raw);
}

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = await request.json();
  const parsed = orchestrateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "請輸入明確目標。" }, { status: 400 });
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "尚未設定 AI 金鑰。請在 .env 設定 AI_API_KEY（OpenAI 相容）或 ANTHROPIC_API_KEY（Claude）。",
      },
      { status: 500 },
    );
  }

  const goal = parsed.data.goal.trim();
  const requestedDepth = parsed.data.depth as OrchestrateDepth;
  const ultraSaving = isUltraSavingModeEnabled();
  const allowUpgrade = Boolean(parsed.data.allowUpgrade);
  const depth: OrchestrateDepth =
    ultraSaving && !allowUpgrade ? "quick" : requestedDepth;
  const workerIds = getWorkerIdsForDepth(depth);
  const workerConcurrency = config.provider === "anthropic" ? 1 : 2;

  try {
    const workerOutputs = await mapWithConcurrency(workerIds, workerConcurrency, async (id) => {
        const member = getTeamMember(id);
        if (!member) throw new Error(`未知成員：${id}`);

        const systemPrompt = await loadSystemPrompt(id);
        const content = await withRetryOnRateLimit(async () =>
          generateText(config, systemPrompt, [
            {
              role: "user",
              content: `公司目標：${goal}

你正在參加「跨部門任務會議」。請只從你這個角色出發，輸出可執行內容：
1) 你本週最重要 3 項任務（每項要有交付物）
2) KPI 與門檻（保留/淘汰）
3) 需要哪些角色配合
4) 風險提醒（最多 3 點）

請用繁體中文，條列清楚，避免空話。`,
            },
          ]),
        );

        return { id, name: member.name, content };
      });

    const directorPrompt = await loadSystemPrompt("director");
    const discussionBundle = workerOutputs
      .map((w) => `### ${w.name}\n${w.content}`)
      .join("\n\n");

    const finalPlan = await withRetryOnRateLimit(async () =>
      generateText(config, directorPrompt, [
        {
          role: "user",
          content: `你是總監，請整合以下跨部門討論結果，產出「公司可直接執行的一份方案」。

【公司目標】
${goal}

【各部門討論紀要】
${discussionBundle}

請用這個格式輸出：
1. 執行摘要（3-5 行）
2. 本週總工單（依優先序，格式：角色 / 任務 / 截止 / 驗收）
3. 30 天行動節奏（每週重點）
4. KPI 看板（核心 6 指標 + 目標值）
5. 風險與預案
6. 今天立刻可做的 5 件事`,
        },
      ]),
    );

    return NextResponse.json({
      ok: true,
      goal,
      depth,
      plan: finalPlan,
      discussions: workerOutputs,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "協作流程發生錯誤";
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}

async function withRetryOnRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1200, 2500, 4500];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimited = /rate limit|concurrent|too many requests|529|429/i.test(msg);
      if (!isRateLimited || attempt >= delays.length) {
        throw err;
      }
      await sleep(delays[attempt]);
      attempt += 1;
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runner() {
    while (next < items.length) {
      const current = next;
      next += 1;
      results[current] = await worker(items[current]);
    }
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: limit }, () => runner()));
  return results;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

