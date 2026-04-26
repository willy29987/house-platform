import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const toggleSchema = z.object({
  isPublished: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 才能更新上架狀態。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "狀態格式錯誤。" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!listing) {
    return NextResponse.json({ ok: false, message: "找不到房源。" }, { status: 404 });
  }

  await prisma.listing.update({
    where: { id },
    data: { isPublished: parsed.data.isPublished },
  });

  return NextResponse.json({ ok: true });
}
