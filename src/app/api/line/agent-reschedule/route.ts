import { NextResponse } from "next/server";
import { getLineRentalCase } from "@/lib/line-rental-cases";
import { submitAgentProposedWhen } from "@/lib/line-viewing-agent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId")?.trim() ?? "";
  if (!caseId) {
    return NextResponse.json({ error: "缺少案件編號" }, { status: 400 });
  }
  const caseRecord = await getLineRentalCase(caseId);
  if (!caseRecord) {
    return NextResponse.json({ error: "找不到約看案件" }, { status: 404 });
  }
  return NextResponse.json({
    id: caseRecord.id,
    status: caseRecord.status,
    displayName: caseRecord.displayName,
    phone: caseRecord.phone,
    requestedWhen: caseRecord.requestedWhen,
    proposedWhen: caseRecord.proposedWhen,
    picked: caseRecord.picked,
    criteriaText: caseRecord.criteriaText,
    canPropose:
      caseRecord.status === "awaiting_agent" ||
      caseRecord.status === "agent_proposing" ||
      caseRecord.status === "pending_confirm",
  });
}

export async function POST(request: Request) {
  let body: { caseId?: string; proposedWhen?: string; agentLineUserId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const proposedWhen = typeof body.proposedWhen === "string" ? body.proposedWhen.trim() : "";
  if (!caseId || !proposedWhen) {
    return NextResponse.json({ error: "缺少案件或時間" }, { status: 400 });
  }

  const result = await submitAgentProposedWhen({
    caseId,
    proposedWhen,
    agentLineUserId: typeof body.agentLineUserId === "string" ? body.agentLineUserId : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, case: result.case });
}
