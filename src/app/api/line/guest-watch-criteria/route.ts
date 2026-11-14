import { NextResponse } from "next/server";
import { emptyCriteria, type RentalMatchCriteria } from "@/lib/line-rental-assistant";
import { upsertGuestWatchCriteria } from "@/lib/line-guest-watch";

export const dynamic = "force-dynamic";

type Body = {
  lineUserId?: string;
  displayName?: string;
  criteria?: Partial<RentalMatchCriteria>;
  priceMin?: number | null;
  priceMax?: number | null;
  petNote?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId.trim() : "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const base = emptyCriteria();
  const incoming = body.criteria && typeof body.criteria === "object" ? body.criteria : {};
  const criteria: RentalMatchCriteria = {
    cities: Array.isArray(incoming.cities) ? incoming.cities.map(String) : base.cities,
    districts: Array.isArray(incoming.districts) ? incoming.districts.map(String) : base.districts,
    rooms: Array.isArray(incoming.rooms) ? incoming.rooms.map(String) : base.rooms,
    bathrooms: Array.isArray(incoming.bathrooms)
      ? incoming.bathrooms.map(String)
      : base.bathrooms,
    parking: Array.isArray(incoming.parking) ? incoming.parking.map(String) : base.parking,
    priceKeys: Array.isArray(incoming.priceKeys) ? incoming.priceKeys.map(String) : base.priceKeys,
    extras: Array.isArray(incoming.extras) ? (incoming.extras as RentalMatchCriteria["extras"]) : base.extras,
  };

  try {
    const watch = await upsertGuestWatchCriteria({
      lineUserId,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      criteria,
      priceMin: body.priceMin,
      priceMax: body.priceMax,
      petNote: typeof body.petNote === "string" ? body.petNote : "",
      active: body.active !== false,
    });
    return NextResponse.json({ ok: true, watch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
