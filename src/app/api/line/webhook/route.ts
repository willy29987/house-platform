import { createHmac, timingSafeEqual } from "crypto";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { handle591LinkInquiry, handleImageInquiry } from "@/lib/line-591-inquiry";
import {
  appendLineConversationMessage,
  recordLineFriendFollow,
  recordLineFriendUnfollow,
  type LineConversationMediaType,
} from "@/lib/line-conversations";
import { handleGuestPostback, handleGuestText } from "@/lib/line-guest-flow";
import { notifyAdminsLineGuestMessage } from "@/lib/admin-web-push";
import { getLineUserProfile, replyLineMessages } from "@/lib/line-messaging";
import { readLineChannelSecretFromCloud } from "@/lib/line-runtime-secrets";
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
  timestamp?: number;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: {
    type?: string;
    id?: string;
    text?: string;
    packageId?: string;
    stickerId?: string;
    title?: string;
    address?: string;
    fileName?: string;
  };
  postback?: {
    data?: string;
  };
};

type LineWebhookBody = {
  events?: LineEvent[];
};

function signatureMatches(rawBody: string, signature: string, secret: string): boolean {
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function verifyLineSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const envSecret = process.env.LINE_CHANNEL_SECRET?.trim() ?? "";
  if (signatureMatches(rawBody, signature, envSecret)) return true;
  // Vercel env 可能過期／缺漏：改比對雲端備份的 channel secret
  const cloudSecret = await readLineChannelSecretFromCloud();
  return signatureMatches(rawBody, signature, cloudSecret);
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

function previewForIncomingMessage(message: NonNullable<LineEvent["message"]>): {
  text: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
} | null {
  const type = message.type;
  if (type === "text") {
    const text = message.text?.trim() ?? "";
    return text ? { text } : null;
  }
  if (type === "image") return { text: "［圖片］", mediaType: "image" };
  if (type === "video") return { text: "［影片］", mediaType: "video" };
  if (type === "audio") return { text: "［語音］", mediaType: "audio" };
  if (type === "file") {
    return {
      text: `［檔案］${message.fileName?.trim() || ""}`.trim(),
      mediaType: "file",
    };
  }
  if (type === "location") {
    const title = message.title?.trim();
    const address = message.address?.trim();
    const text =
      title && address
        ? `［位置］${title}（${address}）`
        : title || address
          ? `［位置］${title || address}`
          : "［位置］";
    return { text, mediaType: "location" };
  }
  if (type === "sticker") {
    return {
      text: "［貼圖］",
      mediaType: "sticker",
      stickerId: message.stickerId?.trim() || undefined,
      packageId: message.packageId?.trim() || undefined,
    };
  }
  return type ? { text: `［${type}］` } : null;
}

async function storeGuestMessage(input: {
  lineUserId: string;
  text: string;
  displayName?: string;
  pictureUrl?: string;
  messageId?: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
}) {
  try {
    const saved = await appendLineConversationMessage({
      lineUserId: input.lineUserId,
      from: "guest",
      text: input.text,
      displayName: input.displayName,
      pictureUrl: input.pictureUrl,
      messageId: input.messageId,
      mediaType: input.mediaType,
      stickerId: input.stickerId,
      packageId: input.packageId,
    });
    // 新訊息才推播；重複 webhook 不重複吵
    if (saved) {
      void notifyAdminsLineGuestMessage({
        lineUserId: input.lineUserId,
        displayName: input.displayName || "LINE 客人",
        text: input.text,
      }).catch((error) => {
        console.warn("[line/webhook] admin web push failed", error);
      });
    }
  } catch (error) {
    console.error("[line/webhook] append guest message failed", error);
  }
}

async function resolveGuestProfile(userId: string | null): Promise<{
  displayName: string;
  pictureUrl?: string;
}> {
  if (!userId) return { displayName: "LINE 客人" };
  const profile = await getLineUserProfile(userId);
  return {
    displayName: profile?.displayName || "LINE 客人",
    pictureUrl: profile ? profile.pictureUrl : undefined,
  };
}

async function handleEvent(event: LineEvent) {
  const userId = event.source?.userId ?? null;
  rememberLineUserId(userId, event.type);

  if (event.type === "follow" || event.type === "unfollow") {
    if (!userId) return;
    try {
      if (event.type === "follow") {
        const profile = await resolveGuestProfile(userId);
        await recordLineFriendFollow({
          lineUserId: userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          timestamp: event.timestamp,
        });
      } else {
        await recordLineFriendUnfollow({
          lineUserId: userId,
          timestamp: event.timestamp,
        });
      }
    } catch (error) {
      console.error("[line/webhook] follow/unfollow store failed", error);
    }
    return;
  }

  const guestProfile = await resolveGuestProfile(userId);
  const displayName = guestProfile.displayName;
  const pictureUrl = guestProfile.pictureUrl;

  if (event.type === "postback") {
    if (!event.replyToken) return;
    const data = event.postback?.data?.trim() ?? "";
    if (!data || !userId) return;

    const postbackLabel = guessPostbackDisplayText(data);
    if (postbackLabel) {
      await storeGuestMessage({
        lineUserId: userId,
        text: postbackLabel,
        displayName,
        pictureUrl,
        messageId: `postback:${event.replyToken}:${data}`,
      });
    }

    if (data.startsWith("guest:")) {
      await handleGuestPostback({
        replyToken: event.replyToken,
        lineUserId: userId,
        data,
        displayName,
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

  const message = event.message;
  if (!message) return;
  const preview = previewForIncomingMessage(message);

  // 先寫入客服對話（不因業務帳號／缺 replyToken 而跳過）
  if (userId && preview) {
    await storeGuestMessage({
      lineUserId: userId,
      text: preview.text,
      displayName,
      pictureUrl,
      messageId: message.id,
      mediaType: preview.mediaType,
      stickerId: preview.stickerId,
      packageId: preview.packageId,
    });
  }

  if (!event.replyToken) return;

  const messageType = message.type;

  if (messageType === "text") {
    const text = message.text?.trim() ?? "";
    if (!text) return;

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
        displayName,
      });
      if (guestHandled) return;
    }

    const result = await handle591LinkInquiry({
      text,
      lineUserId: userId,
      displayName,
    });
    if (!result) return;
    await replyLineMessages(event.replyToken, result.messages, { lineUserId: userId });
    return;
  }

  if (messageType === "image") {
    // 圖片已寫入對話；可建案件給客服，但不自動回客人話術
    if (userId && isViewingAgentUserId(userId)) return;
    await handleImageInquiry({
      lineUserId: userId,
      displayName,
      imageMessageId: message.id,
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const skipVerify = process.env.LINE_WEBHOOK_SKIP_VERIFY === "true";

  if (!skipVerify && !(await verifyLineSignature(rawBody, signature))) {
    console.warn("[line/webhook] invalid signature");
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
