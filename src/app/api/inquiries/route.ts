import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createInquirySchema = z.object({
  listingId: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().min(8),
  message: z.string().max(1000).optional(),
  contactTime: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 才能接收聯絡表單。" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = createInquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "欄位格式不正確", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const exists = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ ok: false, message: "找不到房源資料。" }, { status: 404 });
  }

  await prisma.inquiry.create({
    data: {
      listingId: parsed.data.listingId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      message: parsed.data.message || null,
      contactTime: parsed.data.contactTime || null,
    },
  });

  return NextResponse.json({ ok: true });
}
