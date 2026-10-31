import { NextResponse } from "next/server";
import { completeGuestLiffPick } from "@/lib/line-guest-flow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    sessionId?: string;
    requestedWhen?: string;
    picked?: { id: string; title: string; price: number }[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const requestedWhen = typeof body.requestedWhen === "string" ? body.requestedWhen.trim() : "";
  const picked = Array.isArray(body.picked) ? body.picked : [];
  if (!sessionId) {
    return NextResponse.json({ error: "缺少 session" }, { status: 400 });
  }

  const result = await completeGuestLiffPick({
    sessionId,
    requestedWhen,
    picked: picked.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      price: Number(item.price) || 0,
    })),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
