import { NextResponse } from "next/server";
import { sendGuestRecommendationDigest } from "@/lib/line-guest-watch-notify";
import {
  readOpsSchedule,
  shouldRunPush,
  taipeiParts,
  writeOpsSchedule,
} from "@/lib/ops-schedule";

export const runtime = "nodejs";
export const maxDuration = 60;
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
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const schedule = await readOpsSchedule();
    if (!force && !shouldRunPush(schedule)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: schedule.pushEnabled
          ? "未到設定的推播時段，或今日已推過"
          : "後台已關閉彙整推播",
        schedule,
      });
    }

    const summary = await sendGuestRecommendationDigest();
    const now = new Date();
    const next = await writeOpsSchedule({
      ...schedule,
      lastPushAt: now.toISOString(),
      lastPushDay: taipeiParts(now).dayKey,
    });
    return NextResponse.json({ ok: true, summary, schedule: next });
  } catch (error) {
    console.error("[cron/guest-recommendation-digest]", error);
    const message = error instanceof Error ? error.message : "彙整推播失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
