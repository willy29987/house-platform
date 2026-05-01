import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/admin-auth";
import { parseListingInternalMeta, toListingDescription } from "@/lib/listing-internal-meta";
import { prisma } from "@/lib/prisma";

const toggleSchema = z.object({
  isPublished: z.boolean(),
  unpublishCategory: z.enum(["DEAL", "PAUSE"]).optional(),
  unpublishNote: z.string().optional(),
  expectedReleaseDate: z.string().optional(),
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
    select: { id: true, description: true },
  });

  if (!listing) {
    return NextResponse.json({ ok: false, message: "找不到房源。" }, { status: 404 });
  }
  const owner = parseListingInternalMeta(listing.description).createdByUsername;
  if (current.role !== "SUPER_ADMIN" && owner && owner !== current.username) {
    return NextResponse.json({ ok: false, message: "你只能上下架自己刊登的廣告。" }, { status: 403 });
  }

  if (!parsed.data.isPublished) {
    if (!parsed.data.unpublishCategory) {
      return NextResponse.json({ ok: false, message: "請選擇下架類型。" }, { status: 400 });
    }
    if (parsed.data.unpublishCategory === "PAUSE" && !parsed.data.unpublishNote?.trim()) {
      return NextResponse.json({ ok: false, message: "請備註暫停出租原因。" }, { status: 400 });
    }
    if (parsed.data.unpublishCategory === "DEAL" && !parsed.data.expectedReleaseDate?.trim()) {
      return NextResponse.json({ ok: false, message: "請填寫預計釋出日期。" }, { status: 400 });
    }
  }

  const meta = parseListingInternalMeta(listing.description);
  await prisma.listing.update({
    where: { id },
    data: {
      isPublished: parsed.data.isPublished,
      description: toListingDescription({
        ...meta,
        unpublishCategory: parsed.data.isPublished ? null : (parsed.data.unpublishCategory ?? null),
        unpublishNote: parsed.data.isPublished ? null : (parsed.data.unpublishNote?.trim() || null),
        expectedReleaseDate: parsed.data.isPublished ? null : (parsed.data.expectedReleaseDate?.trim() || null),
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
