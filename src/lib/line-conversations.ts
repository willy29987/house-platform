/** 真實 LINE 對話紀錄（以 webhook／實際送出內容為準） */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import type { LineMessage } from "@/lib/line-messaging";

export type LineConversationFrom = "guest" | "bot" | "staff";

export type LineConversationMediaType =
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "file"
  | "location";

export type LineConversationMessage = {
  id: string;
  from: LineConversationFrom;
  text: string;
  createdAt: string;
  messageId?: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
};

export type LineConversation = {
  lineUserId: string;
  displayName: string;
  updatedAt: string;
  messages: LineConversationMessage[];
};

type Store = {
  conversations: LineConversation[];
};

const MAX_CONVERSATIONS = 200;
const MAX_MESSAGES = 200;

const MEDIA_TYPES = new Set<LineConversationMediaType>([
  "image",
  "video",
  "audio",
  "sticker",
  "file",
  "location",
]);

function normalizeMessage(raw: unknown): LineConversationMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<LineConversationMessage>;
  if (
    typeof m.id !== "string" ||
    typeof m.text !== "string" ||
    (m.from !== "guest" && m.from !== "bot" && m.from !== "staff")
  ) {
    return null;
  }
  const mediaType =
    typeof m.mediaType === "string" && MEDIA_TYPES.has(m.mediaType as LineConversationMediaType)
      ? (m.mediaType as LineConversationMediaType)
      : undefined;
  return {
    id: m.id,
    from: m.from,
    text: m.text,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
    messageId: typeof m.messageId === "string" ? m.messageId : undefined,
    mediaType,
    stickerId: typeof m.stickerId === "string" ? m.stickerId : undefined,
    packageId: typeof m.packageId === "string" ? m.packageId : undefined,
  };
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return { conversations: [] };
  const rows = Array.isArray((payload as Store).conversations)
    ? (payload as Store).conversations
    : [];
  return {
    conversations: rows
      .filter((row) => row && typeof row.lineUserId === "string")
      .map((row) => ({
        lineUserId: row.lineUserId,
        displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
        updatedAt:
          typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
        messages: Array.isArray(row.messages)
          ? row.messages
              .map(normalizeMessage)
              .filter((m): m is LineConversationMessage => Boolean(m))
              .slice(-MAX_MESSAGES)
          : [],
      }))
      .slice(0, MAX_CONVERSATIONS),
  };
}

function previewTextFromLineMessage(message: LineMessage): string {
  if (message.type === "text") return message.text;
  if (message.type === "template") {
    const t = message.template;
    if (t.type === "buttons") return message.altText || t.text || t.title || "[卡片訊息]";
    if (t.type === "confirm") return message.altText || t.text || "[確認訊息]";
  }
  return message.altText || "[訊息]";
}

export async function readLineConversations(): Promise<LineConversation[]> {
  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  return store.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLineConversation(
  lineUserId: string,
): Promise<LineConversation | null> {
  const all = await readLineConversations();
  return all.find((item) => item.lineUserId === lineUserId) ?? null;
}

export async function appendLineConversationMessage(input: {
  lineUserId: string;
  from: LineConversationFrom;
  text: string;
  displayName?: string;
  messageId?: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
}): Promise<LineConversationMessage | null> {
  const lineUserId = input.lineUserId.trim();
  const text = input.text.trim();
  if (!lineUserId || !text) return null;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  const index = store.conversations.findIndex((row) => row.lineUserId === lineUserId);
  const existing = index >= 0 ? store.conversations[index] : null;

  // 避免同一則 webhook message 重複寫入
  if (input.messageId && existing?.messages.some((m) => m.messageId === input.messageId)) {
    return null;
  }

  const now = new Date().toISOString();
  const message: LineConversationMessage = {
    id: `lcm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    from: input.from,
    text,
    createdAt: now,
    messageId: input.messageId,
    mediaType: input.mediaType,
    stickerId: input.stickerId,
    packageId: input.packageId,
  };

  if (!existing) {
    store.conversations.unshift({
      lineUserId,
      displayName: input.displayName?.trim() || "LINE 客人",
      updatedAt: now,
      messages: [message],
    });
  } else {
    const current = existing;
    current.updatedAt = now;
    if (input.displayName?.trim()) current.displayName = input.displayName.trim();
    // 真實 webhook 抵達時，拿掉同內容的案件備援種子（case:…）
    const cleaned =
      input.messageId && !input.messageId.startsWith("case:")
        ? current.messages.filter(
            (m) => !(m.messageId?.startsWith("case:") && m.text === text && m.from === input.from),
          )
        : current.messages;
    current.messages = [...cleaned, message].slice(-MAX_MESSAGES);
    store.conversations.splice(index, 1);
    store.conversations.unshift(current);
  }

  store.conversations = store.conversations.slice(0, MAX_CONVERSATIONS);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations, store);
  return message;
}

export async function appendLineConversationBotMessages(input: {
  lineUserId: string;
  messages: LineMessage[];
  displayName?: string;
}) {
  for (const message of input.messages) {
    const text = previewTextFromLineMessage(message);
    await appendLineConversationMessage({
      lineUserId: input.lineUserId,
      from: "bot",
      text,
      displayName: input.displayName,
    });
  }
}
