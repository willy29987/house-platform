/**
 * 客人問租補／報稅／入戶籍／寵物／還在嗎時，依最近相關物件屬性組回覆，
 * 並以 1～3 分鐘隨機延遲 push（reply token 無法撐這麼久）。
 */

import { after } from "next/server";
import { ListingType } from "@prisma/client";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { resolve591IdFromUrlOrId } from "@/lib/listing-591-id";
import { getGuestNewListingIds } from "@/lib/line-guest-rich-menu";
import { getLatestGuestSessionWithPicked } from "@/lib/line-guest-sessions";
import { pushLineMessages } from "@/lib/line-messaging";
import { normalizeItemList } from "@/lib/furniture-appliance-value";
import { parseListingInternalMeta } from "@/lib/listing-internal-meta";
import {
  loadRentalMatchListingAny,
  toRentalMatchListing,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { readLineRentalCases } from "@/lib/line-rental-cases";
import { prisma } from "@/lib/prisma";

export type ListingConditionTopic =
  | "pets"
  | "subsidy"
  | "tax"
  | "register"
  | "available";

export type DelayedGuestReplyItem = {
  id: string;
  lineUserId: string;
  text: string;
  listingId: string | null;
  topics: ListingConditionTopic[];
  sendAt: string;
  status: "pending" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
  failReason?: string;
};

type Store = { items: DelayedGuestReplyItem[] };

const TOPIC_PATTERNS: { topic: ListingConditionTopic; re: RegExp }[] = [
  { topic: "pets", re: /寵物|養狗|養貓|可寵|養寵物|帶寵|貓狗|毛孩/ },
  { topic: "subsidy", re: /租補|租屋補助|租金補助|補助/ },
  { topic: "tax", re: /報稅|扣抵|列報/ },
  { topic: "register", re: /入戶籍|入籍|遷入戶籍|設籍|遷戶籍|戶籍/ },
  {
    topic: "available",
    re: /還在|在不在|有沒有了|租出去|被租走|已出租|已經租|下架了|還能看|還可以看|還開著|還能約|是否還在|還有嗎/,
  },
];

const QUESTIONISH_RE =
  /嗎|嘛|？|\?|可以|可否|能不能|可不可以|行不行|有沒有|允不允許|允許|支援|方便|在不在|OK|ok|Ok/;

/** 正式：1～3 分隨機 */
const MIN_DELAY_MS = 1 * 60 * 1000;
const MAX_DELAY_MS = 3 * 60 * 1000;

/** 也可 .env 設 LINE_CONDITION_REPLY_TEST_DELAY_MS=3000 覆寫（毫秒，正式勿設） */
function delayBoundsMs() {
  const raw = process.env.LINE_CONDITION_REPLY_TEST_DELAY_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 5 * 60 * 1000) {
      return { min: n, max: n };
    }
  }
  return { min: MIN_DELAY_MS, max: MAX_DELAY_MS };
}

function normalizeStore(payload: unknown): Store {
  if (!payload || typeof payload !== "object") return { items: [] };
  const items = Array.isArray((payload as Store).items) ? (payload as Store).items : [];
  return {
    items: items
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.lineUserId === "string" &&
          typeof item.text === "string" &&
          typeof item.sendAt === "string" &&
          (item.status === "pending" || item.status === "sent" || item.status === "failed"),
      )
      .slice(0, 200),
  };
}

async function readStore() {
  return normalizeStore(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineDelayedGuestReplies));
}

async function writeStore(store: Store) {
  store.items = store.items.slice(0, 200);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineDelayedGuestReplies, store);
}

export function detectListingConditionTopics(text: string): ListingConditionTopic[] {
  const raw = text.trim();
  if (!raw || !QUESTIONISH_RE.test(raw)) return [];
  const topics: ListingConditionTopic[] = [];
  for (const { topic, re } of TOPIC_PATTERNS) {
    if (re.test(raw) && !topics.includes(topic)) topics.push(topic);
  }
  return topics;
}

function randomDelayMs() {
  const { min, max } = delayBoundsMs();
  if (min >= max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 後台物件 id、或 591 網址／編號 → 出租物件（含已下架，供「還在嗎」） */
async function loadListingByIdOr591Ref(raw: string | null | undefined): Promise<RentalMatchListing | null> {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const byId = await loadRentalMatchListingAny(text);
  if (byId) return byId;

  const { id: source591Id } = resolve591IdFromUrlOrId(text);
  if (!source591Id || !process.env.DATABASE_URL) return null;
  try {
    const row = await prisma.listing.findFirst({
      where: {
        source591Id,
        listingType: ListingType.RENT,
      },
    });
    if (!row) return null;
    const meta = parseListingInternalMeta(row.description);
    return toRentalMatchListing({
      ...row,
      furnitureItems: normalizeItemList(meta.furnitureItems),
      equipmentItems: normalizeItemList(meta.equipmentItems),
      securityDeposit: meta.securityDeposit ?? null,
      availableFrom: meta.availableFrom ?? null,
      shortTermRent: meta.shortTermRent ?? null,
      serviceFee: meta.serviceFee ?? null,
      houseCondition: meta.houseCondition ?? null,
      isPublished: row.isPublished,
    });
  } catch (error) {
    console.error("[line-listing-condition-reply] load by 591 failed", error);
    return null;
  }
}

/** 本機／後台預覽：只組回覆，不排程、不 push */
export async function previewListingConditionReply(input: {
  text: string;
  listingId?: string | null;
  lineUserId?: string | null;
}) {
  const topics = detectListingConditionTopics(input.text);
  const fromField = await loadListingByIdOr591Ref(input.listingId);
  const fromMessage = fromField ? null : await loadListingByIdOr591Ref(input.text);
  const fromUser =
    fromField || fromMessage
      ? null
      : input.lineUserId
        ? await resolveFocusListingId(input.lineUserId)
        : null;
  const fromFocus = fromUser ? await loadRentalMatchListingAny(fromUser) : null;
  const listing = fromField || fromMessage || fromFocus;
  const replyText = topics.length
    ? buildListingConditionReplyText({ listing, topics })
    : "";
  const bounds = delayBoundsMs();
  return {
    detected: topics.length > 0,
    topics,
    listingId: listing?.id ?? null,
    listingTitle: listing?.title ?? null,
    source591Id: listing ? undefined : resolve591IdFromUrlOrId(input.listingId || "").id,
    attrs: listing
      ? {
          petsAllowed: listing.petsAllowed,
          rentSubsidy: listing.rentSubsidy,
          taxDeductible: listing.taxDeductible,
          canRegisterAddress: listing.canRegisterAddress,
          isPublished: listing.isPublished ?? true,
        }
      : null,
    replyText,
    delaySec: { min: Math.round(bounds.min / 1000), max: Math.round(bounds.max / 1000) },
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TOPIC_LABEL: Record<ListingConditionTopic, string> = {
  pets: "養寵物",
  subsidy: "租補",
  tax: "報稅",
  register: "入籍",
  available: "還在的房子",
};

function attrForTopic(
  listing: RentalMatchListing,
  topic: ListingConditionTopic,
): boolean | null | undefined {
  if (topic === "pets") return listing.petsAllowed;
  if (topic === "subsidy") return listing.rentSubsidy;
  if (topic === "tax") return listing.taxDeductible;
  if (topic === "register") return listing.canRegisterAddress;
  // 還在嗎：以上架為準（明確布林，不做 unknown）
  return listing.isPublished !== false;
}

function joinTopicLabels(topics: ListingConditionTopic[]) {
  return topics.map((t) => TOPIC_LABEL[t]).join("、");
}

/** 可以：固定句（不帶 XXX） */
function yesConditionReplyText() {
  return "您好～可以的～幫我點選「挑選看屋時間 」，會有其他相似物件供您參考，確定想看的物件告訴我們想要看屋的時間就好嘍～";
}

/** 不行：固定句，XXX＝養寵物／租補／報稅／入籍 */
function noConditionReplyText(xxx: string) {
  return `您好～這個物件可能比較沒辦法哦～有需要${xxx}可以點選「 開始找房 」挑選合適您的物件～如果您可以接受不能${xxx}的話，點選「 挑選看屋時間 」進去會有其他相似的物件供您參考～確定想看的物件告訴我們想要看屋的時間就好嘍～`;
}

export function buildListingConditionReplyText(input: {
  listing: RentalMatchListing | null;
  topics: ListingConditionTopic[];
}): string {
  const topics = input.topics;
  if (!topics.length) return "";

  if (!input.listing) {
    return [
      "關於租補／報稅／入戶籍／寵物／是否還在，要對到「哪一間」我才能依物件資料回你。",
      "請再開一次物件卡片，或貼該間連結／截圖，我再跟你確認。",
    ].join("\n");
  }

  const listing = input.listing;
  const denied: ListingConditionTopic[] = [];
  const allowed: ListingConditionTopic[] = [];
  const unknown: ListingConditionTopic[] = [];

  for (const topic of topics) {
    const value = attrForTopic(listing, topic);
    if (value === true) allowed.push(topic);
    else if (value === false) denied.push(topic);
    else unknown.push(topic);
  }

  // 有任一「不行」→ 用不行固定句（XXX 只帶不行的項目）
  if (denied.length > 0) {
    return noConditionReplyText(joinTopicLabels(denied));
  }
  // 全都可以 → 可以固定句
  if (allowed.length === topics.length) {
    return yesConditionReplyText();
  }
  // 其餘＝尚未標明，不亂回可以／不行
  const xxx = joinTopicLabels(unknown.length ? unknown : topics);
  return `不好意思～這間「${xxx}」的資料我這邊還沒標清楚，先幫你跟業務確認後再回你～`;
}

async function resolveFocusListingId(lineUserId: string): Promise<string | null> {
  const uid = lineUserId.trim();
  if (!uid) return null;

  const cases = await readLineRentalCases();
  const latestCase = cases
    .filter((item) => item.lineUserId === uid && item.picked.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latestCase?.picked[0]?.id) return latestCase.picked[0].id;

  const newIds = await getGuestNewListingIds(uid);
  if (newIds[0]) return newIds[0];

  const session = await getLatestGuestSessionWithPicked(uid);
  if (session?.picked[0]?.id) return session.picked[0].id;

  return null;
}

async function enqueueDelayedReply(input: {
  lineUserId: string;
  text: string;
  listingId: string | null;
  topics: ListingConditionTopic[];
  delayMs: number;
}) {
  const store = await readStore();
  const now = Date.now();
  const item: DelayedGuestReplyItem = {
    id: `ldr_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    lineUserId: input.lineUserId,
    text: input.text,
    listingId: input.listingId,
    topics: input.topics,
    sendAt: new Date(now + input.delayMs).toISOString(),
    status: "pending",
    createdAt: new Date(now).toISOString(),
  };
  // 同一客人尚未送出的同類回覆只留最新一筆，避免連問刷推播
  store.items = [
    item,
    ...store.items.filter(
      (row) => !(row.lineUserId === input.lineUserId && row.status === "pending"),
    ),
  ].slice(0, 200);
  await writeStore(store);
  return item;
}

/** 到期就 push；已送過則略過（after 與 cron 雙保險） */
export async function flushDueDelayedGuestReplies(opts?: { onlyId?: string; now?: Date }) {
  const store = await readStore();
  const now = opts?.now ?? new Date();
  const due = store.items.filter((item) => {
    if (item.status !== "pending") return false;
    if (opts?.onlyId && item.id !== opts.onlyId) return false;
    return Date.parse(item.sendAt) <= now.getTime();
  });
  if (!due.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of due) {
    // 先標記 sent 再推，降低雙重觸發重複推播機率
    const idx = store.items.findIndex((row) => row.id === item.id);
    if (idx < 0 || store.items[idx].status !== "pending") {
      skipped += 1;
      continue;
    }
    store.items[idx] = {
      ...store.items[idx],
      status: "sent",
      sentAt: new Date().toISOString(),
    };
    await writeStore(store);

    const result = await pushLineMessages(
      item.lineUserId,
      [{ type: "text", text: item.text }],
      { force: true, logAs: "bot" },
    );
    if (!result.sent) {
      failed += 1;
      const failIdx = store.items.findIndex((row) => row.id === item.id);
      if (failIdx >= 0) {
        store.items[failIdx] = {
          ...store.items[failIdx],
          status: "failed",
          failReason: "reason" in result ? String(result.reason) : "push_failed",
        };
        await writeStore(store);
      }
      console.warn("[line-listing-condition-reply] push failed", item.id, result);
      continue;
    }
    sent += 1;
  }

  return { sent, failed, skipped };
}

/**
 * 若偵測到條件問句：排程 1～3 分隨機延遲回覆並回 true（表示已接手，webhook 勿再走其他自動回）。
 */
export async function maybeScheduleListingConditionReply(input: {
  lineUserId: string;
  text: string;
}): Promise<boolean> {
  const topics = detectListingConditionTopics(input.text);
  if (!topics.length) return false;

  const fromMessage = await loadListingByIdOr591Ref(input.text);
  const focusId = fromMessage ? null : await resolveFocusListingId(input.lineUserId);
  const listing =
    fromMessage || (focusId ? await loadRentalMatchListingAny(focusId) : null);
  const replyText = buildListingConditionReplyText({ listing, topics });
  if (!replyText) return false;

  const delayMs = randomDelayMs();
  const item = await enqueueDelayedReply({
    lineUserId: input.lineUserId,
    text: replyText,
    listingId: listing?.id ?? focusId ?? null,
    topics,
    delayMs,
  });

  // 準時備援：函式仍活著就等到點再送；被平台掐掉時靠每分鐘 cron
  after(async () => {
    try {
      const waitMs = Math.max(0, Date.parse(item.sendAt) - Date.now());
      if (waitMs > 0) await sleep(waitMs);
      await flushDueDelayedGuestReplies({ onlyId: item.id });
    } catch (error) {
      console.warn("[line-listing-condition-reply] after flush failed", error);
    }
  });

  console.info(
    "[line-listing-condition-reply] scheduled",
    item.id,
    `delaySec=${Math.round(delayMs / 1000)}`,
    `listing=${item.listingId ?? "none"}`,
    `topics=${topics.join(",")}`,
  );
  return true;
}
