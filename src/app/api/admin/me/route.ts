import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";

/** 輕量後台身分（給 AdminShell 非阻塞載入，避免 layout await 卡住切頁） */
export async function GET() {
  const current = await getCurrentAdmin();
  if (!current) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      username: current.username,
      displayName: current.displayName ?? null,
      role: current.role,
    },
  });
}
