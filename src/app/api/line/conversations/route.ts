import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { readLineConversations } from "@/lib/line-conversations";
import { listOpenGuestSessions } from "@/lib/line-guest-sessions";
import { pushLineMessages } from "@/lib/line-messaging";
import { readLineRentalCases } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401, headers: NO_STORE });
  }

  const [conversations, cases, sessions] = await Promise.all([
    readLineConversations(),
    readLineRentalCases(),
    listOpenGuestSessions(),
  ]);

  return NextResponse.json(
    { conversations, cases, sessions, fetchedAt: new Date().toISOString() },
    { headers: NO_STORE },
  );
}

/** 客服從網頁回覆 → 推到 LINE，並寫入同一份對話紀錄 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { lineUserId?: string; text?: string };
  try {
    body = (await request.json()) as { lineUserId?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const lineUserId = body.lineUserId?.trim() ?? "";
  const text = body.text?.trim() ?? "";
  if (!lineUserId || !text) {
    return NextResponse.json({ error: "缺少 lineUserId 或 text" }, { status: 400 });
  }

  const pushed = await pushLineMessages(
    lineUserId,
    [{ type: "text", text }],
    { force: true, logAs: "staff" },
  );
  if (!pushed.sent) {
    return NextResponse.json(
      { error: "推播失敗", detail: pushed },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
