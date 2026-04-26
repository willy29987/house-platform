import { ContentChannel, ContentDraftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getContentDraftDelegate, missingContentDraftMessage } from "@/lib/content-draft-delegate";
import {
  buildAlgorithmNotes,
  buildCaptionFromSource,
  crawlUrl,
  extractHashtags,
} from "@/lib/content-pipeline";

const importSchema = z.object({
  url: z.string().url(),
  targetChannels: z.array(z.nativeEnum(ContentChannel)).default(["INSTAGRAM", "FACEBOOK"]),
});

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const contentDraft = getContentDraftDelegate();
  if (!contentDraft) {
    return NextResponse.json({ ok: false, message: missingContentDraftMessage() }, { status: 500 });
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "請提供有效網址" }, { status: 400 });
  }

  const source = await crawlUrl(parsed.data.url);
  const caption = buildCaptionFromSource(source);
  const script = `【來源重點摘要】\n${source.text.slice(0, 800)}\n\n【短影音建議】\n- 開場：先拋一個與地區/房型相關的痛點\n- 中段：用 2-3 個關鍵數字做對比\n- 結尾：單一 CTA（留言「想看」或私訊）`;

  const draft = await contentDraft.create({
    data: {
      title: source.title,
      hook: `你知道這個市場變化會影響你買房成本嗎？`,
      script,
      caption,
      hashtags: extractHashtags(caption),
      algorithmNotes: buildAlgorithmNotes(parsed.data.targetChannels),
      sourceType: "CRAWLER",
      sourceUrl: source.sourceUrl,
      targetChannels: parsed.data.targetChannels,
      status: ContentDraftStatus.PENDING_REVIEW,
    },
  });

  return NextResponse.json({ ok: true, draft });
}

