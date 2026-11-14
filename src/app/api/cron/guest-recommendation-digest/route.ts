import { NextResponse } from "next/server";
import { sendGuestRecommendationDigest } from "@/lib/line-guest-watch-notify";

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
    const summary = await sendGuestRecommendationDigest();
    return NextResponse.json({ ok: true, summary });
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
