import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { handle591LinkInquiry, handleImageInquiry } from "@/lib/line-591-inquiry";
import { replyLineMessages } from "@/lib/line-messaging";
import {
  handleAgentProposeText,
  handleViewingAgentPostback,
  handleViewingGuestPostback,
  isViewingAgentUserId,
  parseViewingPostback,
} from "@/lib/line-viewing-agent";

export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: {
    type?: string;
    id?: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
};

type LineWebhookBody = {
  events?: LineEvent[];
};

function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim() ?? "";
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handleEvent(event: LineEvent) {
  if (!event.replyToken) return;
  const userId = event.source?.userId ?? null;

  if (event.type === "postback") {
    const data = event.postback?.data?.trim() ?? "";
    if (!data || !userId) return;
    const parsed = parseViewingPostback(data);
    if (!parsed) return;

    if (parsed.action === "guest_accept") {
      await handleViewingGuestPostback({
        replyToken: event.replyToken,
        guestLineUserId: userId,
        data,
      });
      return;
    }

    await handleViewingAgentPostback({
      replyToken: event.replyToken,
      agentLineUserId: userId,
      data,
    });
    return;
  }

  if (event.type !== "message") return;

  const messageType = event.message?.type;

  if (messageType === "text") {
    const text = event.message?.text?.trim() ?? "";
    if (!text) return;

    if (userId && isViewingAgentUserId(userId)) {
      const handled = await handleAgentProposeText({
        replyToken: event.replyToken,
        agentLineUserId: userId,
        text,
      });
      if (handled) return;
      // 業務帳號一般訊息不走客人 591／圖片流程
      return;
    }

    const result = await handle591LinkInquiry({
      text,
      lineUserId: userId,
      displayName: "LINE 客人",
    });
    if (!result) return;
    await replyLineMessages(event.replyToken, result.messages);
    return;
  }

  if (messageType === "image") {
    if (userId && isViewingAgentUserId(userId)) return;
    const result = await handleImageInquiry({
      lineUserId: userId,
      displayName: "LINE 客人",
      imageMessageId: event.message?.id,
    });
    await replyLineMessages(event.replyToken, result.messages);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const skipVerify = process.env.LINE_WEBHOOK_SKIP_VERIFY === "true";

  if (!skipVerify && !verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  await Promise.all(
    events.map(async (event) => {
      try {
        await handleEvent(event);
      } catch (error) {
        console.error("[line/webhook] event error", error);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}

/** LINE 驗證 webhook URL 時可能打 GET */
export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}
