import { NextResponse } from "next/server";
import { flushDueDelayedGuestReplies } from "@/lib/line-listing-condition-reply";

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
    const summary = await flushDueDelayedGuestReplies();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/line-delayed-replies]", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "處理失敗" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
