import { NextResponse } from "next/server";
import { assertSync591AgentToken, touchSync591AgentHeartbeat } from "@/lib/591-sync-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await assertSync591AgentToken(request.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  let label: string | undefined;
  try {
    const body = (await request.json()) as { label?: string };
    label = body.label;
  } catch {
    // ok
  }
  await touchSync591AgentHeartbeat(label);
  return NextResponse.json({ ok: true });
}
