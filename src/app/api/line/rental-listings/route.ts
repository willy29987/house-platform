import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { loadRentalMatchListings } from "@/lib/line-rental-assistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

/** 客服頁背景載入可推播／配對的上架出租物件 */
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const listings = await loadRentalMatchListings(60);
  return NextResponse.json({ listings }, { headers: NO_STORE });
}
