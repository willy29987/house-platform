import { NextResponse } from "next/server";
import {
  runBanqiao591SuiteSync,
  scrub591TransferPhones,
  scrubBanqiaoSyncedOwnerTrackingNotes,
} from "@/lib/listing-591-banqiao-sync";
import {
  readOpsSchedule,
  shouldRunSync,
  writeOpsSchedule,
} from "@/lib/ops-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const scrubOnly = url.searchParams.get("scrubOnly") === "1";
    if (scrubOnly) {
      const transferPhones = await scrub591TransferPhones();
      const scrub = await scrubBanqiaoSyncedOwnerTrackingNotes();
      return NextResponse.json({ ok: true, transferPhones, scrub });
    }

    const force = url.searchParams.get("force") === "1";
    const schedule = await readOpsSchedule();
    if (!force && !shouldRunSync(schedule)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: schedule.syncEnabled
          ? `未到間隔（每 ${schedule.syncIntervalHours} 小時）`
          : "後台已關閉 591 自動抓取",
        schedule,
      });
    }

    const maxRaw = Number(url.searchParams.get("maxDetails") ?? "");
    const maxDetails = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(Math.round(maxRaw), 80) : undefined;
    const summary = await runBanqiao591SuiteSync(maxDetails ? { maxDetails } : undefined);
    const next = await writeOpsSchedule({
      ...schedule,
      lastSyncAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, summary, schedule: next });
  } catch (error) {
    console.error("[cron/591-banqiao-sync]", error);
    const message = error instanceof Error ? error.message : "同步失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
