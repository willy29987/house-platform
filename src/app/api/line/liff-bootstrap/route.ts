import { NextResponse } from "next/server";
import { buildLiffBootstrap } from "@/lib/line-liff-bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = await buildLiffBootstrap({
      uid: url.searchParams.get("uid") ?? undefined,
      listingId: url.searchParams.getAll("listingId"),
      similar: url.searchParams.get("similar") ?? undefined,
      "liff.state": url.searchParams.get("liff.state") ?? undefined,
    });
    return NextResponse.json({ ok: true, ...payload }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/line/liff-bootstrap]", error);
    return NextResponse.json(
      { ok: false, message: "載入失敗", listings: [], directListing: null },
      { status: 500, headers: NO_STORE },
    );
  }
}
