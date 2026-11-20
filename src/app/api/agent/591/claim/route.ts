import { NextResponse } from "next/server";
import {
  assertSync591AgentToken,
  claimNextSync591Jobs,
  touchSync591AgentHeartbeat,
} from "@/lib/591-sync-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await assertSync591AgentToken(request.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  let label: string | undefined;
  let limit = 3;
  try {
    const body = (await request.json()) as { label?: string; limit?: number };
    label = body.label;
    if (typeof body.limit === "number" && body.limit > 0) limit = Math.min(10, Math.round(body.limit));
  } catch {
    // empty body ok
  }
  await touchSync591AgentHeartbeat(label);
  const jobs = await claimNextSync591Jobs(limit);
  return NextResponse.json({ ok: true, jobs });
}
