import { NextResponse } from "next/server";
import { clearGuestNewListings } from "@/lib/line-guest-rich-menu";

export const dynamic = "force-dynamic";

/** 客人在 LIFF 看過新物件後呼叫：圖文選單換回「開始找房」。 */
export async function POST(request: Request) {
  let body: { uid?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const uid = body.uid?.trim() ?? "";
  if (!/^U[0-9a-f]{32}$/.test(uid)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await clearGuestNewListings(uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/line/new-listings/seen]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
