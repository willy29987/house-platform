import { NextResponse } from "next/server";
import { softenGuestNewListings } from "@/lib/line-guest-rich-menu";
import { clearGuestRecommendationPending } from "@/lib/line-guest-watch-notify";

export const dynamic = "force-dynamic";

/** 客人在 LIFF 看過新物件：選單改「繼續看屋」，並略過這批中午推播。 */
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
    await softenGuestNewListings(uid);
    await clearGuestRecommendationPending(uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/line/new-listings/seen]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
