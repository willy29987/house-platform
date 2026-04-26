import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const toggleSchema = z.object({
  isHandled: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 才能更新聯絡單狀態。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "狀態格式錯誤。" }, { status: 400 });
  }

  const exists = await prisma.inquiry.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ ok: false, message: "找不到聯絡單。" }, { status: 404 });
  }

  await prisma.inquiry.update({
    where: { id },
    data: {
      isHandled: parsed.data.isHandled,
      handledAt: parsed.data.isHandled ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
