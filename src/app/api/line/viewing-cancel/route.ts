import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getLineRentalCase } from "@/lib/line-rental-cases";
import { canCancelViewing, cancelViewingCase } from "@/lib/line-viewing-cancel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId")?.trim() ?? "";
  const demo = url.searchParams.get("demo") === "1";

  if (demo || caseId === "demo") {
    return NextResponse.json({
      id: "demo",
      status: "confirmed",
      displayName: "示範客人",
      requestedWhen: "2026/11/20 下午 14:00–16:00",
      proposedWhen: "",
      picked: [
        { id: "demo-1", title: "板橋文化路兩房", price: 28000 },
        { id: "demo-2", title: "江子翠近捷運套房", price: 15000 },
      ],
      canCancel: true,
      demo: true,
    });
  }

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
    requestedWhen: caseRecord.requestedWhen,
    proposedWhen: caseRecord.proposedWhen,
    picked: caseRecord.picked,
    canCancel: canCancelViewing(caseRecord),
    cancelledBy: caseRecord.cancelledBy ?? null,
    demo: false,
  });
}

export async function POST(request: Request) {
  let body: {
    caseId?: string;
    cancelledBy?: "guest" | "agent" | "staff";
    lineUserId?: string;
    cancelNote?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const cancelledBy = body.cancelledBy;
  if (!caseId || (cancelledBy !== "guest" && cancelledBy !== "agent" && cancelledBy !== "staff")) {
    return NextResponse.json({ error: "缺少案件或取消來源" }, { status: 400 });
  }

  if (caseId === "demo") {
    return NextResponse.json({
      ok: true,
      alreadyCancelled: false,
      case: { id: "demo", status: "cancelled" },
      demo: true,
    });
  }

  if (cancelledBy === "staff") {
    const guard = await requireAdminSession();
    if (guard) return guard;
  }

  const result = await cancelViewingCase({
    caseId,
    cancelledBy,
    actorLineUserId: typeof body.lineUserId === "string" ? body.lineUserId : null,
    cancelNote: typeof body.cancelNote === "string" ? body.cancelNote : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    alreadyCancelled: result.alreadyCancelled,
    case: {
      id: result.case.id,
      status: result.case.status,
      cancelledBy: result.case.cancelledBy,
      cancelledAt: result.case.cancelledAt,
    },
  });
}
