import { NextResponse } from "next/server";
import { criteriaSummary, emptyCriteria } from "@/lib/line-rental-assistant";
import { getGuestSessionForLiff } from "@/lib/line-guest-flow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "缺少 session" }, { status: 400 });
  }
  const data = await getGuestSessionForLiff(sessionId);
  if (!data) {
    return NextResponse.json({ error: "找不到進度" }, { status: 404 });
  }
  const criteria = emptyCriteria();
  criteria.cities = data.session.cities;
  criteria.districts = data.session.districts;
  criteria.rooms = data.session.rooms;
  criteria.priceKeys = data.session.priceKeys;
  criteria.extras = data.session.extras;
  return NextResponse.json({
    sessionId: data.session.id,
    step: data.session.step,
    criteriaText: criteriaSummary(criteria),
    listings: data.listings,
    relaxed: data.relaxed,
  });
}
