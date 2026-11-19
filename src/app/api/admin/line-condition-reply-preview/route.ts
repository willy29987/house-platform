import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { previewListingConditionReply } from "@/lib/line-listing-condition-reply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1),
  listingId: z.string().optional(),
  lineUserId: z.string().optional(),
});

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "參數錯誤" }, { status: 400 });
  }

  try {
    const preview = await previewListingConditionReply({
      text: parsed.data.text,
      listingId: parsed.data.listingId,
      lineUserId: parsed.data.lineUserId,
    });
    return NextResponse.json({ ok: true, ...preview });
  } catch (error) {
    console.error("[admin/line-condition-reply-preview]", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "預覽失敗" },
      { status: 500 },
    );
  }
}
