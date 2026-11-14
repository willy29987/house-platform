import { NextResponse } from "next/server";
import {
  runBanqiao591SuiteSync,
  scrub591TransferPhones,
  scrubBanqiaoSyncedOwnerTrackingNotes,
} from "@/lib/listing-591-banqiao-sync";

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
    const scrubOnly = new URL(request.url).searchParams.get("scrubOnly") === "1";
    if (scrubOnly) {
      const transferPhones = await scrub591TransferPhones();
      const scrub = await scrubBanqiaoSyncedOwnerTrackingNotes();
      return NextResponse.json({ ok: true, transferPhones, scrub });
    }
    const summary = await runBanqiao591SuiteSync();
    return NextResponse.json({ ok: true, summary });
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
