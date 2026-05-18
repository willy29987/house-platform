import { NextResponse } from "next/server";
import { getListingsByIds } from "@/lib/listings";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];
    const listings = await getListingsByIds(ids);
    return NextResponse.json(listings);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
