import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSync591AgentToken,
  enqueue591ExpiryScan,
  touchSync591AgentHeartbeat,
} from "@/lib/591-sync-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  label: z.string().optional(),
  staleHours: z.number().int().min(1).max(168).optional(),
  limit: z.number().int().min(1).max(80).optional(),
  force: z.boolean().optional(),
});

/** 本機 Agent 週期呼叫：把過期檢查排進佇列 */
export async function POST(request: Request) {
  if (!(await assertSync591AgentToken(request.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });
  }
  let body: z.infer<typeof bodySchema> = {};
  try {
    body = bodySchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ ok: false, message: "參數無效" }, { status: 400 });
  }
  await touchSync591AgentHeartbeat(body.label);
  const { jobs, scannedCandidates } = await enqueue591ExpiryScan({
    staleHours: body.staleHours,
    limit: body.limit,
    force: body.force,
  });
  return NextResponse.json({
    ok: true,
    enqueued: jobs.length,
    scannedCandidates,
    jobIds: jobs.map((j) => j.id),
  });
}
