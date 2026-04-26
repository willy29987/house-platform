import { ContentDraftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, requireAdminSession } from "@/lib/admin-auth";
import { getContentDraftDelegate, missingContentDraftMessage } from "@/lib/content-draft-delegate";
import { scheduleToBuffer } from "@/lib/content-pipeline";

const approveSchema = z.object({
  scheduleAt: z.string().datetime().optional(),
  sendToBuffer: z.boolean().default(false),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) {
    return NextResponse.json({ ok: false, message: missingContentDraftMessage() }, { status: 500 });
  }
  const current = await getCurrentAdmin();

  const { id } = await context.params;
  const body = await request.json();
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "核准參數錯誤" }, { status: 400 });
  }

  const draft = await contentDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ ok: false, message: "找不到內容草稿" }, { status: 404 });

  let status: ContentDraftStatus = ContentDraftStatus.APPROVED;
  let scheduledAt: Date | null = null;
  let externalPostId: string | null = null;
  let bufferResult: unknown = null;

  if (parsed.data.scheduleAt) {
    scheduledAt = new Date(parsed.data.scheduleAt);
  }

  if (parsed.data.sendToBuffer && scheduledAt) {
    const result = await scheduleToBuffer({
      text: `${draft.hook}\n\n${draft.caption}`.trim(),
      channels: draft.targetChannels,
      scheduledAt,
    });
    bufferResult = result;
    if (result.scheduled.length > 0) {
      status = ContentDraftStatus.SCHEDULED;
      externalPostId = result.scheduled.map((x) => x.updateId).join(",");
    }
  }

  const updated = await contentDraft.update({
    where: { id },
    data: {
      status,
      approvedAt: new Date(),
      approvedBy: current?.username || "admin",
      scheduledAt,
      externalPostId,
    },
  });

  return NextResponse.json({ ok: true, draft: updated, bufferResult });
}

