import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/admin-auth";
import { parseListingInternalMeta } from "@/lib/listing-internal-meta";
import { clearListingFromGuestPushQueues } from "@/lib/line-guest-watch-notify";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  guestPushEnabled: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const current = await getCurrentAdmin();
  if (!current) return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 才能更新推播設定。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "狀態格式錯誤。" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      description: true,
      listingType: true,
      guestPushEnabled: true,
    },
  });

  if (!listing) {
    return NextResponse.json({ ok: false, message: "找不到房源。" }, { status: 404 });
  }
  if (listing.listingType !== "RENT") {
    return NextResponse.json({ ok: false, message: "僅出租物件可設定客人推播。" }, { status: 400 });
  }

  const owner = parseListingInternalMeta(listing.description).createdByUsername;
  if (current.role !== "SUPER_ADMIN" && owner && owner !== current.username) {
    return NextResponse.json({ ok: false, message: "你只能改自己刊登物件的推播設定。" }, { status: 403 });
  }

  await prisma.listing.update({
    where: { id },
    data: { guestPushEnabled: parsed.data.guestPushEnabled },
  });

  if (!parsed.data.guestPushEnabled) {
    await clearListingFromGuestPushQueues(id).catch((error) => {
      console.warn("[api/admin/listings guest-push] clear queues failed", error);
    });
  }

  return NextResponse.json({ ok: true, guestPushEnabled: parsed.data.guestPushEnabled });
}
