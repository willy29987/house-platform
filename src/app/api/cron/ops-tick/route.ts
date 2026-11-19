import { NextResponse } from "next/server";
import { runBanqiao591SuiteSync } from "@/lib/listing-591-banqiao-sync";
import { sendGuestRecommendationDigest } from "@/lib/line-guest-watch-notify";
import {
  readOpsSchedule,
  shouldRunPush,
  shouldRunSync,
  taipeiParts,
  writeOpsSchedule,
} from "@/lib/ops-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-cron-secret")?.trim() ?? "";
  return header === secret;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }

  const now = new Date();
  let schedule = await readOpsSchedule();
  const taipei = taipeiParts(now);
  const result: {
    sync: "skipped" | "ran" | "error";
    push: "skipped" | "ran" | "error";
    syncSummary?: unknown;
    pushSummary?: unknown;
    message?: string;
    schedule: typeof schedule;
  } = {
    sync: "skipped",
    push: "skipped",
    schedule,
  };

  // 推播先跑（較短）；再跑 591（可能很久）
  if (shouldRunPush(schedule, now)) {
    try {
      result.pushSummary = await sendGuestRecommendationDigest();
      schedule = await writeOpsSchedule({
        ...schedule,
        lastPushAt: now.toISOString(),
        lastPushDay: taipei.dayKey,
      });
      result.push = "ran";
    } catch (error) {
      console.error("[cron/ops-tick] push", error);
      result.push = "error";
      result.message = error instanceof Error ? error.message : "推播失敗";
    }
  }

  if (shouldRunSync(schedule, now)) {
    try {
      result.syncSummary = await runBanqiao591SuiteSync();
      schedule = await writeOpsSchedule({
        ...schedule,
        lastSyncAt: now.toISOString(),
      });
      result.sync = "ran";
    } catch (error) {
      console.error("[cron/ops-tick] sync", error);
      result.sync = "error";
      result.message = [
        result.message,
        error instanceof Error ? error.message : "同步失敗",
      ]
        .filter(Boolean)
        .join("；");
    }
  }

  result.schedule = schedule;
  const ok = result.sync !== "error" && result.push !== "error";
  return NextResponse.json(
    { ok, taipei, ...result },
    { status: ok ? 200 : 500 },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
