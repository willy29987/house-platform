/** 真實 LINE 對話紀錄（以 webhook／實際送出內容為準） */

import type { Prisma } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import type { LineMessage } from "@/lib/line-messaging";
import { prisma } from "@/lib/prisma";

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
  /** LINE 頭像；空字串＝已查過但沒有圖；缺欄＝尚未查 */
  pictureUrl?: string;
  updatedAt: string;
  /** 加入／再次加入好友時間（ISO）；unfollow 後再 follow 會更新 */
  followedAt?: string;
  /** 解除好友／封鎖時間（ISO）；再次 follow 時清除 */
  unfollowedAt?: string;
  messages: LineConversationMessage[];
};

type Store = {
  conversations: LineConversation[];
  /** 每次成功寫入加一，用來避免同時寫入時後者蓋掉前者 */
  revision: number;
};

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

function messageMergeKey(message: LineConversationMessage): string {
  return message.messageId ? `mid:${message.messageId}` : `id:${message.id}`;
}

function mergeMessages(
  left: LineConversationMessage[],
  right: LineConversationMessage[],
): LineConversationMessage[] {
  const byKey = new Map<string, LineConversationMessage>();
  for (const message of [...left, ...right]) {
    const key = messageMergeKey(message);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, message);
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...message,
      text: message.text || prev.text,
      createdAt: prev.createdAt <= message.createdAt ? prev.createdAt : message.createdAt,
      mediaType: message.mediaType ?? prev.mediaType,
      stickerId: message.stickerId ?? prev.stickerId,
      packageId: message.packageId ?? prev.packageId,
      messageId: message.messageId ?? prev.messageId,
    });
  }

  const realText = new Set(
    [...byKey.values()]
      .filter((message) => message.messageId && !message.messageId.startsWith("case:"))
      .map((message) => `${message.from}\n${message.text}`),
  );
  const messages = [...byKey.values()].filter(
    (message) =>
      !(message.messageId?.startsWith("case:") && realText.has(`${message.from}\n${message.text}`)),
  );
  messages.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  return messages;
}

function mergeConversation(left: LineConversation, right: LineConversation): LineConversation {
  const newer = left.updatedAt >= right.updatedAt ? left : right;
  const older = newer === left ? right : left;
  const messages = mergeMessages(left.messages, right.messages);
  const lastAt = messages[messages.length - 1]?.createdAt;
  const updatedAt = [newer.updatedAt, older.updatedAt, lastAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)!;
  return {
    lineUserId: newer.lineUserId,
    displayName: newer.displayName || older.displayName,
    pictureUrl: newer.pictureUrl ?? older.pictureUrl,
    followedAt: newer.followedAt ?? older.followedAt,
    unfollowedAt: newer.updatedAt >= older.updatedAt ? newer.unfollowedAt : older.unfollowedAt,
    updatedAt,
    messages,
  };
}

function mergeStores(existing: Store, incoming: Store): Store {
  const byUser = new Map<string, LineConversation>();
  for (const row of existing.conversations) byUser.set(row.lineUserId, row);
  for (const row of incoming.conversations) {
    const prev = byUser.get(row.lineUserId);
    byUser.set(row.lineUserId, prev ? mergeConversation(prev, row) : row);
  }
  return { conversations: [...byUser.values()], revision: existing.revision };
}

/**
 * 整包覆寫會在兩則訊息同時進來時把其中一則蓋掉。
 * 寫入前再讀最新內容做聯集，並用 revision 對上才覆寫；沒對上就重試。
 */
async function persistLineConversationStore(incoming: Store): Promise<void> {
  const key = ADMIN_CLOUD_DATA_KEYS.lineConversations;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt));
    }
    const row = await prisma.adminCloudData.findUnique({ where: { key } });
    const existing = normalizeStore(row?.payload);
    const merged = mergeStores(existing, incoming);
    const payload = {
      ...merged,
      revision: existing.revision + 1,
    } as unknown as Prisma.InputJsonValue;
    if (!row) {
      try {
        await prisma.adminCloudData.create({ data: { key, payload } });
        return;
      } catch {
        continue;
      }
    }
    const updated = await prisma.$executeRaw`
      UPDATE "AdminCloudData"
      SET payload = CAST(${JSON.stringify(payload)} AS jsonb),
          "updatedAt" = NOW()
      WHERE key = ${key}
        AND COALESCE(CAST(payload->>'revision' AS integer), 0) = ${existing.revision}
    `;
    if (Number(updated) === 1) return;
  }
  throw new Error("LINE 對話寫入衝突，請稍後再試");
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return { conversations: [], revision: 0 };
  const revisionRaw = (payload as { revision?: unknown }).revision;
  const revision =
    typeof revisionRaw === "number" && Number.isInteger(revisionRaw) && revisionRaw >= 0
      ? revisionRaw
      : 0;
  const rows = Array.isArray((payload as Store).conversations)
    ? (payload as Store).conversations
    : [];
  return {
    revision,
    conversations: rows
      .filter((row) => row && typeof row.lineUserId === "string")
      .map((row) => ({
        lineUserId: row.lineUserId,
        displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
        pictureUrl: typeof row.pictureUrl === "string" ? row.pictureUrl : undefined,
        updatedAt:
          typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
        followedAt: typeof row.followedAt === "string" ? row.followedAt : undefined,
        unfollowedAt: typeof row.unfollowedAt === "string" ? row.unfollowedAt : undefined,
        messages: Array.isArray(row.messages)
          ? row.messages
              .map(normalizeMessage)
              .filter((m): m is LineConversationMessage => Boolean(m))
          : [],
      })),
  };
}

function previewTextFromLineMessage(message: LineMessage): string {
  if (message.type === "text") return message.text;
  if (message.type === "sticker") return "［貼圖］";
  if (message.type === "image") return "［圖片］";
  if (message.type === "video") return "［影片］";
  if (message.type === "template") {
    const t = message.template;
    if (t.type === "buttons") return message.altText || t.text || t.title || "[卡片訊息]";
    if (t.type === "confirm") return message.altText || t.text || "[確認訊息]";
  }
  return ("altText" in message && message.altText) || "[訊息]";
}

function toIsoFromLineTimestamp(timestamp?: number): string {
  if (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

/** 找房表單先 sendMessages、再寫案件時，用剛進對話的原文對回 Messaging userId。 */
export async function findRecentGuestUserIdByExactText(
  text: string,
  withinMs = 5 * 60_000,
): Promise<string | null> {
  const needle = text.trim();
  if (!needle) return null;
  const conversations = await readLineConversations();
  const now = Date.now();
  let best: { lineUserId: string; at: number } | null = null;
  for (const row of conversations) {
    for (const message of row.messages) {
      if (message.from !== "guest" || message.text !== needle) continue;
      const at = new Date(message.createdAt).getTime();
      const age = now - at;
      if (!Number.isFinite(age) || age < 0 || age > withinMs) continue;
      if (!best || at > best.at) best = { lineUserId: row.lineUserId, at };
    }
  }
  return best?.lineUserId ?? null;
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

/** 記錄加好友（含再次加入）；永久保留對話，不刪減 */
export async function recordLineFriendFollow(input: {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  timestamp?: number;
}): Promise<LineConversation | null> {
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) return null;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  const index = store.conversations.findIndex((row) => row.lineUserId === lineUserId);
  const now = toIsoFromLineTimestamp(input.timestamp);
  const displayName = input.displayName?.trim() || "LINE 客人";

  if (index < 0) {
    const created: LineConversation = {
      lineUserId,
      displayName,
      pictureUrl: input.pictureUrl,
      updatedAt: now,
      followedAt: now,
      messages: [],
    };
    store.conversations.unshift(created);
    await persistLineConversationStore(store);
    return created;
  }

  const current = store.conversations[index];
  current.followedAt = now;
  current.unfollowedAt = undefined;
  current.updatedAt = now;
  if (input.displayName?.trim()) current.displayName = input.displayName.trim();
  if (typeof input.pictureUrl === "string") current.pictureUrl = input.pictureUrl;
  store.conversations.splice(index, 1);
  store.conversations.unshift(current);
  await persistLineConversationStore(store);
  return current;
}

/** 記錄封鎖／刪好友；保留既有對話與加入日 */
export async function recordLineFriendUnfollow(input: {
  lineUserId: string;
  timestamp?: number;
}): Promise<void> {
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) return;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  const index = store.conversations.findIndex((row) => row.lineUserId === lineUserId);
  const now = toIsoFromLineTimestamp(input.timestamp);

  if (index < 0) {
    store.conversations.unshift({
      lineUserId,
      displayName: "LINE 客人",
      updatedAt: now,
      unfollowedAt: now,
      messages: [],
    });
  } else {
    const current = store.conversations[index];
    current.unfollowedAt = now;
    current.updatedAt = now;
    store.conversations.splice(index, 1);
    store.conversations.unshift(current);
  }

  await persistLineConversationStore(store);
}

export async function appendLineConversationMessage(input: {
  lineUserId: string;
  from: LineConversationFrom;
  text: string;
  displayName?: string;
  pictureUrl?: string;
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

  // 只略過 LINE 重送的同一則。內容一樣但編號不同的新訊息仍要留下。
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
      pictureUrl: input.pictureUrl,
      updatedAt: now,
      messages: [message],
    });
  } else {
    const current = existing;
    current.updatedAt = now;
    if (input.displayName?.trim()) current.displayName = input.displayName.trim();
    if (typeof input.pictureUrl === "string") current.pictureUrl = input.pictureUrl;
    // 真實 webhook 抵達時，拿掉同內容的案件備援種子（case:…）
    const cleaned =
      input.messageId && !input.messageId.startsWith("case:")
        ? current.messages.filter(
            (m) => !(m.messageId?.startsWith("case:") && m.text === text && m.from === input.from),
          )
        : current.messages;
    current.messages = [...cleaned, message];
    store.conversations.splice(index, 1);
    store.conversations.unshift(current);
  }

  await persistLineConversationStore(store);
  return message;
}

export async function appendLineConversationBotMessages(input: {
  lineUserId: string;
  messages: LineMessage[];
  displayName?: string;
}) {
  for (const message of input.messages) {
    const text = previewTextFromLineMessage(message);
    if (message.type === "sticker") {
      await appendLineConversationMessage({
        lineUserId: input.lineUserId,
        from: "bot",
        text,
        displayName: input.displayName,
        mediaType: "sticker",
        stickerId: message.stickerId,
        packageId: message.packageId,
      });
      continue;
    }
    if (message.type === "image") {
      await appendLineConversationMessage({
        lineUserId: input.lineUserId,
        from: "bot",
        text,
        displayName: input.displayName,
        mediaType: "image",
        messageId: message.originalContentUrl,
      });
      continue;
    }
    if (message.type === "video") {
      await appendLineConversationMessage({
        lineUserId: input.lineUserId,
        from: "bot",
        text,
        displayName: input.displayName,
        mediaType: "video",
        messageId: message.originalContentUrl,
      });
      continue;
    }
    await appendLineConversationMessage({
      lineUserId: input.lineUserId,
      from: "bot",
      text,
      displayName: input.displayName,
    });
  }
}

/** 把已寫入的預約原文清掉 text: 前綴，並換成客人的 LINE 名稱。 */
export async function rewriteLineConversationMessages(
  edits: Array<{ lineUserId: string; messageId: string; text: string }>,
): Promise<void> {
  const useful = edits.filter((row) => row.lineUserId.trim() && row.messageId && row.text.trim());
  if (useful.length === 0) return;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  let changed = false;
  for (const edit of useful) {
    const current = store.conversations.find((row) => row.lineUserId === edit.lineUserId.trim());
    const message = current?.messages.find((row) => row.id === edit.messageId);
    if (!current || !message) continue;
    const text = edit.text.trim();
    if (message.text === text) continue;
    message.text = text;
    changed = true;
  }
  if (changed) await persistLineConversationStore(store);
}

/** 補上已查到的客人頭像／暱稱（一次寫入） */
export async function patchLineConversationProfiles(
  patches: Array<{ lineUserId: string; displayName?: string; pictureUrl?: string }>,
): Promise<void> {
  const useful = patches.filter((row) => row.lineUserId.trim());
  if (useful.length === 0) return;

  const store = normalizeStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineConversations),
  );
  let changed = false;
  for (const patch of useful) {
    const current = store.conversations.find((row) => row.lineUserId === patch.lineUserId.trim());
    if (!current) continue;
    if (patch.displayName?.trim() && current.displayName !== patch.displayName.trim()) {
      current.displayName = patch.displayName.trim();
      changed = true;
    }
    if (typeof patch.pictureUrl === "string" && current.pictureUrl !== patch.pictureUrl) {
      current.pictureUrl = patch.pictureUrl;
      changed = true;
    }
  }
  if (changed) {
    await persistLineConversationStore(store);
  }
}
