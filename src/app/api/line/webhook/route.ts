import { createHmac, timingSafeEqual } from "crypto";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { handle591LinkInquiry, handleImageInquiry } from "@/lib/line-591-inquiry";
import { appendLineConversationMessage } from "@/lib/line-conversations";
import { handleGuestPostback, handleGuestText } from "@/lib/line-guest-flow";
import { replyLineMessages } from "@/lib/line-messaging";
import {
  handleAgentProposeText,
  handleViewingAgentPostback,
  handleViewingGuestPostback,
  isViewingAgentUserId,
  parseViewingPostback,
} from "@/lib/line-viewing-agent";

export const dynamic = "force-dynamic";

function rememberLineUserId(userId: string | null | undefined, eventType?: string) {
  if (!userId) return;
  console.info("[line/webhook] from userId=", userId, "type=", eventType);
  try {
    const dir = path.join(process.cwd(), ".cursor");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, "line-last-userid.txt"),
      `${new Date().toISOString()}\t${userId}\t${eventType ?? ""}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("[line/webhook] rememberLineUserId failed", error);
  }
}

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

/** 依 postback data 還原聊天室大致會出現的 displayText（與送出時 label 對齊） */
function guessPostbackDisplayText(data: string): string | null {
  if (!data) return null;
  if (data === "guest:start") return "開始找房";
  if (data.startsWith("guest:toggle:")) {
    const value = data.split(":").slice(3).join(":");
    return value || null;
  }
  if (data.startsWith("guest:clear:")) return "清除重選";
  if (data.startsWith("guest:next:")) return "下一步";
  if (data === "guest:pet:none") return "沒有寵物";
  if (data.startsWith("guest:people:")) {
    const n = data.split(":")[2];
    return n ? `${n} 人` : null;
  }
  if (data.startsWith("guest:nationality:")) {
    return data.split(":").slice(2).join(":") || null;
  }
  if (data.startsWith("view:")) return data;
  return data.length <= 40 ? data : null;
}

async function handleEvent(event: LineEvent) {
  if (!event.replyToken) return;
  const userId = event.source?.userId ?? null;
  rememberLineUserId(userId, event.type);

  if (event.type === "postback") {
    const data = event.postback?.data?.trim() ?? "";
    if (!data || !userId) return;

    // LINE 聊天室會顯示按鈕的 displayText；webhook 只有 data，還原成客服可見文字
    const postbackLabel = guessPostbackDisplayText(data);
    if (postbackLabel) {
      try {
        await appendLineConversationMessage({
          lineUserId: userId,
          from: "guest",
          text: postbackLabel,
          messageId: `postback:${event.replyToken}:${data}`,
        });
      } catch (error) {
        console.error("[line/webhook] append postback message failed", error);
      }
    }

    if (data.startsWith("guest:")) {
      await handleGuestPostback({
        replyToken: event.replyToken,
        lineUserId: userId,
        data,
      });
      return;
    }

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

    // 先寫入真實對話（含 LIFF sendMessages 進到聊天室的內容）
    if (userId) {
      try {
        await appendLineConversationMessage({
          lineUserId: userId,
          from: "guest",
          text,
          messageId: event.message?.id,
        });
      } catch (error) {
        console.error("[line/webhook] append guest message failed", error);
      }
    }

    // 配對員改時間優先；未命中則同一帳號仍可走客人找房（方便自測）
    if (userId && isViewingAgentUserId(userId)) {
      const handled = await handleAgentProposeText({
        replyToken: event.replyToken,
        agentLineUserId: userId,
        text,
      });
      if (handled) return;
    }

    if (userId) {
      const guestHandled = await handleGuestText({
        replyToken: event.replyToken,
        lineUserId: userId,
        text,
      });
      if (guestHandled) return;
    }

    const result = await handle591LinkInquiry({
      text,
      lineUserId: userId,
      displayName: "LINE 客人",
    });
    if (!result) return;
    await replyLineMessages(event.replyToken, result.messages, { lineUserId: userId });
    return;
  }

  if (messageType === "image") {
    if (userId && isViewingAgentUserId(userId)) return;
    if (userId) {
      try {
        await appendLineConversationMessage({
          lineUserId: userId,
          from: "guest",
          text: "［圖片］",
          messageId: event.message?.id,
        });
      } catch (error) {
        console.error("[line/webhook] append guest image failed", error);
      }
    }
    const result = await handleImageInquiry({
      lineUserId: userId,
      displayName: "LINE 客人",
      imageMessageId: event.message?.id,
    });
    await replyLineMessages(event.replyToken, result.messages, { lineUserId: userId });
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

export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}
