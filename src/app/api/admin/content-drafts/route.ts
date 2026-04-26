import { ContentChannel, ContentDraftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getContentDraftDelegate, missingContentDraftMessage } from "@/lib/content-draft-delegate";
import { buildAlgorithmNotes, extractHashtags } from "@/lib/content-pipeline";

const querySchema = z.object({
  status: z.nativeEnum(ContentDraftStatus).optional(),
});

const createSchema = z.object({
  title: z.string().min(1),
  hook: z.string().default(""),
  script: z.string().default(""),
  caption: z.string().default(""),
  targetChannels: z.array(z.nativeEnum(ContentChannel)).default(["INSTAGRAM"]),
  sourceType: z.string().default("AI_TEAM"),
  sourceUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) {
    return NextResponse.json({ ok: false, message: missingContentDraftMessage() }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "查詢參數錯誤" }, { status: 400 });
  }

  const drafts = await contentDraft.findMany({
    where: parsed.data.status ? { status: parsed.data.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, drafts });
}

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) {
    return NextResponse.json({ ok: false, message: missingContentDraftMessage() }, { status: 500 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "新增內容草稿參數錯誤" }, { status: 400 });
  }

  const data = parsed.data;
  const draft = await contentDraft.create({
    data: {
      title: data.title,
      hook: data.hook,
      script: data.script,
      caption: data.caption,
      hashtags: extractHashtags(data.caption),
      algorithmNotes: buildAlgorithmNotes(data.targetChannels),
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl,
      targetChannels: data.targetChannels,
      status: ContentDraftStatus.PENDING_REVIEW,
    },
  });

  return NextResponse.json({ ok: true, draft });
}

