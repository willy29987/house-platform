/** LINE Messaging API 推播／回覆（僅在 live + token 就緒時真送）。 */

import { appendLineConversationBotMessages } from "@/lib/line-conversations";
import { readLineChannelAccessTokenFromCloud } from "@/lib/line-runtime-secrets";

function lineTokenFromEnv() {
  return (
    process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ||
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function lineLive() {
  const raw = (process.env.LINE_ASSISTANT_LIVE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

async function resolveLineToken() {
  const fromEnv = lineTokenFromEnv();
  if (fromEnv) return fromEnv;
  return readLineChannelAccessTokenFromCloud();
}

/** 客服預覽圖片／影片／語音時用 */
export async function getLineChannelAccessToken() {
  return resolveLineToken();
}

export type LineUserProfile = {
  displayName: string | null;
  /** 有圖才有網址；空字串代表已查過、客人沒設頭像 */
  pictureUrl: string;
};

const profileCache = new Map<string, { profile: LineUserProfile; expiresAt: number }>();

/** 用 Messaging API 取客人 LINE 暱稱與頭像 */
export async function getLineUserProfile(lineUserId: string): Promise<LineUserProfile | null> {
  const userId = lineUserId.trim();
  if (!userId) return null;

  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const token = await resolveLineToken();
  if (!token) return null;

  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { displayName?: string; pictureUrl?: string };
    const profile: LineUserProfile = {
      displayName: data.displayName?.trim() || null,
      pictureUrl: data.pictureUrl?.trim() || "",
    };
    profileCache.set(userId, { profile, expiresAt: Date.now() + 6 * 60 * 60_000 });
    return profile;
  } catch {
    return null;
  }
}

/** 用 Messaging API 取客人 LINE 暱稱（客服名單顯示用） */
export async function getLineUserDisplayName(lineUserId: string): Promise<string | null> {
  const profile = await getLineUserProfile(lineUserId);
  return profile?.displayName ?? null;
}

export type LinePostbackAction = {
  type: "postback";
  label: string;
  data: string;
  displayText?: string;
};

export type LineUriAction = {
  type: "uri";
  label: string;
  uri: string;
};

export type LineMessageAction = LineUriAction | LinePostbackAction | { type: "message"; label: string; text: string };

export type LineMessage =
  | {
      type: "text";
      text: string;
      quickReply?: {
        items: Array<{ type: "action"; action: LineMessageAction }>;
      };
    }
  | {
      type: "sticker";
      packageId: string;
      stickerId: string;
    }
  | {
      type: "image";
      originalContentUrl: string;
      previewImageUrl: string;
    }
  | {
      type: "video";
      originalContentUrl: string;
      previewImageUrl: string;
    }
  | {
      type: "template";
      altText: string;
      template:
        | {
            type: "buttons";
            text: string;
            title?: string;
            actions: Array<LineUriAction | LinePostbackAction>;
          }
        | {
            type: "confirm";
            text: string;
            actions: [LinePostbackAction | LineUriAction, LinePostbackAction | LineUriAction];
          };
      quickReply?: {
        items: Array<{ type: "action"; action: LineMessageAction }>;
      };
    };

export async function pushLineTextMessage(lineUserId: string, text: string) {
  return pushLineMessages(lineUserId, [{ type: "text", text }]);
}

export async function pushLineMessages(
  lineUserId: string,
  messages: LineMessage[],
  options?: { force?: boolean; logAs?: "bot" | "staff" | false },
) {
  if (!lineUserId) {
    return { sent: false as const, reason: "missing_user_id" as const };
  }
  if (!messages.length) {
    return { sent: false as const, reason: "empty_messages" as const };
  }
  const token = await resolveLineToken();
  if (!token) {
    return { sent: false as const, reason: "missing_token" as const };
  }
  if (!options?.force && !lineLive()) {
    return { sent: false as const, reason: "not_live" as const };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false as const, reason: "api_error" as const, status: response.status, body };
  }
  const logAs = options?.logAs === undefined ? "bot" : options.logAs;
  if (logAs) {
    try {
      if (logAs === "staff") {
        const { appendLineConversationMessage } = await import("@/lib/line-conversations");
        for (const message of messages) {
          if (message.type === "sticker") {
            await appendLineConversationMessage({
              lineUserId,
              from: "staff",
              text: "［貼圖］",
              mediaType: "sticker",
              stickerId: message.stickerId,
              packageId: message.packageId,
            });
            continue;
          }
          if (message.type === "image") {
            await appendLineConversationMessage({
              lineUserId,
              from: "staff",
              text: "［圖片］",
              mediaType: "image",
              messageId: message.originalContentUrl,
            });
            continue;
          }
          if (message.type === "video") {
            await appendLineConversationMessage({
              lineUserId,
              from: "staff",
              text: "［影片］",
              mediaType: "video",
              messageId: message.originalContentUrl,
            });
            continue;
          }
          const text =
            message.type === "text"
              ? message.text
              : message.altText || "[訊息]";
          await appendLineConversationMessage({
            lineUserId,
            from: "staff",
            text,
          });
        }
      } else {
        await appendLineConversationBotMessages({ lineUserId, messages });
      }
    } catch (error) {
      console.warn("[line-messaging] append conversation (push) failed", error);
    }
  }
  return { sent: true as const };
}

/** Webhook 用 replyToken 回覆（不需 live 旗標也可在測試時送，仍需 token） */
export async function replyLineMessages(
  replyToken: string,
  messages: LineMessage[],
  options?: { lineUserId?: string | null },
) {
  const token = await resolveLineToken();
  if (!token || !replyToken || !messages.length) {
    return { sent: false as const, reason: "missing_token_or_reply" as const };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false as const, reason: "api_error" as const, status: response.status, body };
  }
  if (options?.lineUserId) {
    try {
      await appendLineConversationBotMessages({
        lineUserId: options.lineUserId,
        messages,
      });
    } catch (error) {
      console.warn("[line-messaging] append conversation (reply) failed", error);
    }
  }
  return { sent: true as const };
}

export function buildPublicBaseUrl() {
  const fromLine = process.env.LINE_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  if (fromLine) return fromLine;
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return fromSite;
}

export function buildLiffRentAssistantUrl(query?: Record<string, string>) {
  const liffId =
    process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "2012308800-rDFp5dsT";
  const qs = query
    ? `?${Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")}`
    : "";
  if (liffId) return `https://liff.line.me/${liffId}${qs}`;
  const base = buildPublicBaseUrl();
  const path = `/liff/rent-assistant${qs}`;
  return base ? `${base}${path}` : path;
}

export function buildAgentRescheduleUrl(caseId: string) {
  const base = buildPublicBaseUrl();
  const path = `/line/agent-reschedule?caseId=${encodeURIComponent(caseId)}`;
  return base ? `${base}${path}` : path;
}

/** Confirm 文案上限約 240 字元 */
export function truncateLineTemplateText(text: string, max = 220): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
