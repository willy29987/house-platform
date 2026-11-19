/**
 * 客人問租補／報稅／入戶籍／寵物時，依最近相關物件屬性組回覆，
 * 並以 2～5 分鐘隨機延遲 push（reply token 無法撐這麼久）。
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
  loadPublishedRentalMatchListing,
  toRentalMatchListing,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { readLineRentalCases } from "@/lib/line-rental-cases";
import { prisma } from "@/lib/prisma";

export type ListingConditionTopic = "pets" | "subsidy" | "tax" | "register";

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
];

const QUESTIONISH_RE =
  /嗎|嘛|？|\?|可以|可否|能不能|可不可以|行不行|有沒有|允不允許|允許|支援|方便|OK|ok|Ok/;

const MIN_DELAY_MS = 2 * 60 * 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

/** 測試用：.env 設 LINE_CONDITION_REPLY_TEST_DELAY_MS=10000 → 約 10 秒就推（正式勿設） */
function delayBoundsMs() {
  const raw = process.env.LINE_CONDITION_REPLY_TEST_DELAY_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000 && n <= MAX_DELAY_MS) {
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

/** 後台物件 id、或 591 網址／編號 → 已上架出租物件 */
async function loadListingByIdOr591Ref(raw: string | null | undefined): Promise<RentalMatchListing | null> {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const byId = await loadPublishedRentalMatchListing(text);
  if (byId) return byId;

  const { id: source591Id } = resolve591IdFromUrlOrId(text);
  if (!source591Id || !process.env.DATABASE_URL) return null;
  try {
    const row = await prisma.listing.findFirst({
      where: {
        source591Id,
        listingType: ListingType.RENT,
        isPublished: true,
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
  const fromFocus = fromUser ? await loadPublishedRentalMatchListing(fromUser) : null;
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
        }
      : null,
    replyText,
    delaySec: { min: Math.round(bounds.min / 1000), max: Math.round(bounds.max / 1000) },
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTriState(
  value: boolean | null | undefined,
  labels: { yes: string; no: string; unknown: string },
) {
  if (value === true) return labels.yes;
  if (value === false) return labels.no;
  return labels.unknown;
}

export function buildListingConditionReplyText(input: {
  listing: RentalMatchListing | null;
  topics: ListingConditionTopic[];
}): string {
  const topics = input.topics;
  if (!topics.length) return "";

  if (!input.listing) {
    return [
      "關於租補／報稅／入戶籍／寵物，要對到「哪一間」我才能依物件資料回你。",
      "請再開一次物件卡片，或貼該間連結／截圖，我再跟你確認。",
    ].join("\n");
  }

  const listing = input.listing;
  const title = listing.title?.trim() || "這間物件";
  const lines: string[] = [`關於「${title}」：`];

  for (const topic of topics) {
    if (topic === "pets") {
      lines.push(
        formatTriState(listing.petsAllowed, {
          yes: "・寵物：可以養",
          no: "・寵物：不行（不可養寵物）",
          unknown: "・寵物：資料尚未標明，我幫你跟業務確認",
        }),
      );
    }
    if (topic === "subsidy") {
      lines.push(
        formatTriState(listing.rentSubsidy, {
          yes: "・租補：可協助申請",
          no: "・租補：這間目前標示不可／不適用",
          unknown: "・租補：資料尚未標明，我幫你跟業務確認",
        }),
      );
    }
    if (topic === "tax") {
      lines.push(
        formatTriState(listing.taxDeductible, {
          yes: "・報稅：可協助申請",
          no: "・報稅：這間目前標示不可／不適用",
          unknown: "・報稅：資料尚未標明，我幫你跟業務確認",
        }),
      );
    }
    if (topic === "register") {
      lines.push(
        formatTriState(listing.canRegisterAddress, {
          yes: "・入戶籍：可協助申請",
          no: "・入戶籍：這間目前標示不可／不適用",
          unknown: "・入戶籍：資料尚未標明，我幫你跟業務確認",
        }),
      );
    }
  }

  lines.push("若還想看屋或比較其他間，跟我說即可～");
  return lines.join("\n");
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
 * 若偵測到條件問句：排程 2～5 分隨機延遲回覆並回 true（表示已接手，webhook 勿再走其他自動回）。
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
    fromMessage || (focusId ? await loadPublishedRentalMatchListing(focusId) : null);
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
