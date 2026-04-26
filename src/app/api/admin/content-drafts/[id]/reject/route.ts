import { ContentDraftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getContentDraftDelegate, missingContentDraftMessage } from "@/lib/content-draft-delegate";

const rejectSchema = z.object({
  note: z.string().min(1, "請輸入退回原因"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) {
    return NextResponse.json({ ok: false, message: missingContentDraftMessage() }, { status: 500 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "退回參數錯誤" }, { status: 400 });
  }

  const existing = await contentDraft.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, message: "找不到內容草稿" }, { status: 404 });

  const draft = await contentDraft.update({
    where: { id },
    data: {
      status: ContentDraftStatus.REJECTED,
      reviewNote: parsed.data.note,
    },
  });

  return NextResponse.json({ ok: true, draft });
}

