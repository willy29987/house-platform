import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { import591ListingFromUrl } from "@/lib/listing-591-import";

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "請貼上 591 連結" }, { status: 400 });
  }
  const url = body && typeof body === "object" && "url" in body ? String((body as { url?: unknown }).url ?? "") : "";

  try {
    const draft = await import591ListingFromUrl(url);
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "帶入失敗";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
