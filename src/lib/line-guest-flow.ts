/** 方案 3：LINE 對話問條件 → LIFF 選房＋時間 → LINE 續問個資 */

import {
  getGuestSessionById,
  getGuestSessionByUserId,
  saveGuestSession,
  type GuestFlowStep,
  type GuestSession,
} from "@/lib/line-guest-sessions";
import {
  EXTRA_OPTIONS,
  RENT_PRICE_OPTIONS,
  criteriaSummary,
  emptyCriteria,
  matchRentals,
  type RentalExtra,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import {
  buildLiffRentAssistantUrl,
  buildPublicBaseUrl,
  pushLineMessages,
  replyLineMessages,
  type LineMessage,
  type LineMessageAction,
} from "@/lib/line-messaging";
import { appendLineRentalCase } from "@/lib/line-rental-cases";
import { VIEWING_SUBMIT_ACK_TEXT } from "@/lib/line-viewing-guest-copy";
import { notifyAgentsOfNewViewing } from "@/lib/line-viewing-agent";

const ROOM_OPTS = [
  { id: "1", label: "1 房" },
  { id: "2", label: "2 房" },
  { id: "3", label: "3 房" },
  { id: "4", label: "4 房以上" },
];

async function replyGuest(
  replyToken: string,
  lineUserId: string,
  messages: LineMessage[],
) {
  return replyLineMessages(replyToken, messages, { lineUserId });
}

const WELCOME =
  "您好～請問最近有在找房子嗎？如果有需要找房子可以點選「 開始找房 」，點選您要的需求就可以推薦您合適的房源哦！";

function qr(actions: LineMessageAction[]) {
  return {
    items: actions.slice(0, 13).map((action) => ({ type: "action" as const, action })),
  };
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function postback(label: string, data: string, displayText?: string): LineMessageAction {
  return { type: "postback", label: label.slice(0, 20), data, displayText: displayText ?? label };
}

export function buildGuestLiffPickUrl(sessionId: string) {
  const liffId = LINE_LIFF_RENT_ASSISTANT_ID;
  const base = buildPublicBaseUrl() || "https://house-platform.vercel.app";
  // 正式 LIFF：帶 mode=pick；同時附網頁備援參數
  if (liffId) {
    return `https://liff.line.me/${liffId}?mode=pick&session=${encodeURIComponent(sessionId)}`;
  }
  return `${base.replace(/\/$/, "")}/liff/rent-assistant?mode=pick&session=${encodeURIComponent(sessionId)}`;
}

async function loadRentListings(): Promise<RentalMatchListing[]> {
  const { loadRentalMatchListings } = await import("@/lib/line-rental-assistant");
  return loadRentalMatchListings(200);
}

function citiesFrom(listings: RentalMatchListing[]) {
  return [...new Set(listings.map((l) => l.city).filter(Boolean))];
}

function districtsFrom(listings: RentalMatchListing[], cities: string[]) {
  const pool = cities.length ? listings.filter((l) => cities.includes(l.city)) : listings;
  return [...new Set(pool.map((l) => l.district).filter(Boolean))];
}

function askCity(session: GuestSession, listings: RentalMatchListing[]): LineMessage {
  const cities = citiesFrom(listings).slice(0, 10);
  const selected = session.cities.length ? `已選：${session.cities.join("、")}` : "可複選，選完按「下一步」";
  return {
    type: "text",
    text: `想住哪個縣市呢？\n${selected}`,
    quickReply: qr([
      ...cities.map((city) => postback(city, `guest:toggle:city:${city}`, city)),
      postback("不限", "guest:clear:city", "縣市不限"),
      postback("下一步", "guest:next:city", "下一步"),
    ]),
  };
}

function askDistrict(session: GuestSession, listings: RentalMatchListing[]): LineMessage {
  const districts = districtsFrom(listings, session.cities).slice(0, 10);
  const selected = session.districts.length ? `已選：${session.districts.join("、")}` : "可複選，選完按「下一步」";
  return {
    type: "text",
    text: `哪些行政區？\n${selected}`,
    quickReply: qr([
      ...districts.map((d) => postback(d, `guest:toggle:district:${d}`, d)),
      postback("不限", "guest:clear:district", "行政區不限"),
      postback("下一步", "guest:next:district", "下一步"),
    ]),
  };
}

function askRooms(session: GuestSession): LineMessage {
  const selected = session.rooms.length
    ? `已選：${session.rooms.map((id) => ROOM_OPTS.find((o) => o.id === id)?.label ?? id).join("、")}`
    : "可複選，選完按「下一步」";
  return {
    type: "text",
    text: `需要幾房？\n${selected}`,
    quickReply: qr([
      ...ROOM_OPTS.map((o) => postback(o.label, `guest:toggle:rooms:${o.id}`, o.label)),
      postback("不限", "guest:clear:rooms", "房數不限"),
      postback("下一步", "guest:next:rooms", "下一步"),
    ]),
  };
}

function askPrice(session: GuestSession): LineMessage {
  const selected = session.priceKeys.length
    ? `已選：${session.priceKeys.map((k) => RENT_PRICE_OPTIONS.find((o) => o.value === k)?.label ?? k).join("、")}`
    : "可複選，選完按「下一步」";
  return {
    type: "text",
    text: `月租預算大概哪些區間？\n${selected}`,
    quickReply: qr([
      ...RENT_PRICE_OPTIONS.slice(0, 6).map((o) =>
        postback(o.label, `guest:toggle:price:${o.value}`, o.label),
      ),
      postback("不限", "guest:clear:price", "預算不限"),
      postback("下一步", "guest:next:price", "下一步"),
    ]),
  };
}

function askExtras(session: GuestSession): LineMessage {
  const selected = session.extras.length
    ? `已選：${session.extras.map((id) => EXTRA_OPTIONS.find((o) => o.id === id)?.label ?? id).join("、")}`
    : "可複選；不需要就按「不限」";
  return {
    type: "text",
    text: `需要租補、報稅、入戶籍嗎？\n${selected}`,
    quickReply: qr([
      ...EXTRA_OPTIONS.map((o) => postback(o.label, `guest:toggle:extras:${o.id}`, o.label)),
      postback("不限", "guest:clear:extras", "補助等不限"),
      postback("下一步", "guest:next:extras", "下一步"),
    ]),
  };
}

function askPet(): LineMessage {
  return {
    type: "text",
    text: "有沒有養寵物？有的話直接回覆是什麼寵物；沒有就點「沒有」。",
    quickReply: qr([postback("沒有", "guest:pet:none", "沒有寵物")]),
  };
}

function openLiffMessage(session: GuestSession): LineMessage[] {
  const criteria = emptyCriteria();
  criteria.cities = session.cities;
  criteria.districts = session.districts;
  criteria.rooms = session.rooms;
  criteria.priceKeys = session.priceKeys;
  criteria.extras = session.extras;
  return [
    {
      type: "text",
      text: `條件已記下：${criteriaSummary(criteria)}\n接下來請選想看的物件與看屋時間。`,
    },
    {
      type: "template",
      altText: "選物件與看屋時間",
      template: {
        type: "buttons",
        title: "選物件與時間",
        text: "同一頁可先選看屋時間，再勾想看的房子。",
        actions: [
          {
            type: "uri",
            label: "開始選房",
            uri: buildGuestLiffPickUrl(session.id),
          },
        ],
      },
    },
  ];
}

function askPeople(): LineMessage {
  return {
    type: "text",
    text: "請問幾個人住？直接回數字，或點選。",
    quickReply: qr(
      [1, 2, 3, 4, 5, 6].map((n) => postback(`${n} 人`, `guest:people:${n}`, `${n} 人`)),
    ),
  };
}

function askOccupation(): LineMessage {
  return {
    type: "text",
    text: "各別職業是？（可簡單描述，例如：上班族、學生）",
  };
}

function askMoveIn(): LineMessage {
  return {
    type: "text",
    text: "預計何時入住？（例如：2026/12 或 越快越好）",
  };
}

function askNationality(): LineMessage {
  return {
    type: "text",
    text: "國籍呢？",
    quickReply: qr([
      postback("台灣", "guest:nationality:台灣", "台灣"),
      postback("其他", "guest:nationality:其他", "其他"),
    ]),
  };
}

function askPhone(): LineMessage {
  return {
    type: "text",
    text: "最後請留下聯絡電話，方便同事跟你確認看屋。",
  };
}

function promptForStep(session: GuestSession, listings: RentalMatchListing[]): LineMessage[] {
  switch (session.step) {
    case "city":
      return [askCity(session, listings)];
    case "district":
      return [askDistrict(session, listings)];
    case "rooms":
      return [askRooms(session)];
    case "price":
      return [askPrice(session)];
    case "extras":
      return [askExtras(session)];
    case "pet":
      return [askPet()];
    case "awaiting_liff":
      return openLiffMessage(session);
    case "people":
      return [askPeople()];
    case "occupation":
      return [askOccupation()];
    case "moveIn":
      return [askMoveIn()];
    case "nationality":
      return [askNationality()];
    case "phone":
      return [askPhone()];
    default:
      return [{ type: "text", text: "已完成，謝謝！" }];
  }
}

function formatPickedListings(session: GuestSession) {
  if (!session.picked.length) return ["（尚未選物件）"];
  return session.picked.map((item, index) => {
    const price =
      item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
    return `${index + 1}. ${item.title}${price}`;
  });
}

function formatGuestPickSummary(session: GuestSession) {
  return [
    "看屋時間：" + (session.requestedWhen || "尚未填寫"),
    "",
    "想看的物件：",
    ...formatPickedListings(session),
  ].join("\n");
}

async function finishCase(session: GuestSession) {
  const criteria = emptyCriteria();
  criteria.cities = session.cities;
  criteria.districts = session.districts;
  criteria.rooms = session.rooms;
  criteria.priceKeys = session.priceKeys;
  criteria.extras = session.extras;
  const pickSummary = formatGuestPickSummary(session);
  const summary = `已記下想看時間（${session.requestedWhen}），待同事確認。`;
  const created = await appendLineRentalCase({
    kind: "viewing",
    status: "awaiting_agent",
    lineUserId: session.lineUserId,
    displayName: session.displayName,
    phone: session.phone,
    occupation: session.occupation,
    nationality: session.nationality,
    peopleCount: session.peopleCount,
    petNote: session.petNote,
    moveInDate: session.moveInDate,
    criteriaText: `${criteriaSummary(criteria)} · ${session.petNote || "寵物未填"}`,
    picked: session.picked,
    requestedWhen: session.requestedWhen,
    summaryText: summary,
  });
  await notifyAgentsOfNewViewing(created);
  session.step = "done";
  await saveGuestSession(session);
  return {
    type: "text" as const,
    text: [
      "基本資料已收到，謝謝！以下是你選好的看屋內容：",
      "",
      pickSummary,
      "",
      `入住人數：${session.peopleCount} 人`,
      `職業：${session.occupation || "未填"}`,
      `預計入住：${session.moveInDate || "未填"}`,
      `國籍：${session.nationality || "未填"}`,
      `電話：${session.phone}`,
      "",
      "時間需同事確認後會再回覆你。",
    ].join("\n"),
  };
}

function openFullLiffFormMessages(lineUserId?: string): LineMessage[] {
  // 必須走 liff.line.me，sendMessages 才會進對話；Endpoint 請指向 Vercel 表單頁
  const uri = buildLiffRentAssistantUrl(
    lineUserId ? { uid: lineUserId } : undefined,
  );
  return [
    { type: "text", text: WELCOME },
    {
      type: "template",
      altText: "開始找房表單",
      template: {
        type: "buttons",
        title: "開始找房",
        text: "一頁式填寫條件、基本資料，並選物件與看屋時間。",
        actions: [{ type: "uri", label: "打開找房表單", uri }],
      },
    },
  ];
}

export async function startGuestFlow(input: {
  replyToken: string;
  lineUserId: string;
  displayName?: string;
}) {
  await replyGuest(input.replyToken, input.lineUserId, openFullLiffFormMessages(input.lineUserId));
}

export async function handleGuestText(input: {
  replyToken: string;
  lineUserId: string;
  text: string;
  displayName?: string;
}): Promise<boolean> {
  const text = input.text.trim();
  if (!text) return false;

  // 找房改為一頁式 LIFF；不再用聊天室追問人數／職業等
  if (/^開始找房$/.test(text) || text.includes("開始找房")) {
    const session = await getGuestSessionByUserId(input.lineUserId);
    if (session && session.step !== "done") {
      session.step = "done";
      await saveGuestSession(session);
    }
    await startGuestFlow(input);
    return true;
  }

  // LIFF 送出的預約原文已進對話，勿再當找房流程文字處理
  if (text.includes("【找房預約】")) {
    const session = await getGuestSessionByUserId(input.lineUserId);
    if (session && session.step !== "done") {
      session.step = "done";
      await saveGuestSession(session);
    }
    return true;
  }

  // 結束舊版聊天問答進度，避免再跳出「幾個人住」
  const session = await getGuestSessionByUserId(input.lineUserId);
  if (session && session.step !== "done") {
    session.step = "done";
    await saveGuestSession(session);
  }

  return false;
}

export async function handleGuestPostback(input: {
  replyToken: string;
  lineUserId: string;
  data: string;
  displayName?: string;
}): Promise<boolean> {
  if (!input.data.startsWith("guest:")) return false;

  // 舊按鈕（人數／縣市等）一律結束問答，改開一頁式表單
  const session = await getGuestSessionByUserId(input.lineUserId);
  if (session && session.step !== "done") {
    session.step = "done";
    await saveGuestSession(session);
  }

  await startGuestFlow(input);
  return true;
}

/** LIFF 選完物件＋時間後呼叫 */
export async function completeGuestLiffPick(input: {
  sessionId: string;
  picked: { id: string; title: string; price: number }[];
  requestedWhen: string;
}): Promise<
  | { ok: true; confirmText: string; followUpMessages: LineMessage[]; pushSent: boolean }
  | { ok: false; error: string }
> {
  const session = await getGuestSessionById(input.sessionId);
  if (!session) return { ok: false, error: "找不到找房進度，請在 LINE 重新開始找房" };
  if (!input.picked.length) return { ok: false, error: "請至少選一間物件" };
  if (!input.requestedWhen.trim()) return { ok: false, error: "請選擇看屋時間" };

  session.picked = input.picked;
  session.requestedWhen = input.requestedWhen.trim();
  // 基本資料已在 LIFF 表單填完，不再聊天追問人數等
  session.step = "done";
  await saveGuestSession(session);

  const confirmText = VIEWING_SUBMIT_ACK_TEXT;
  const followUpMessages: LineMessage[] = [{ type: "text", text: confirmText }];

  const pushed = await pushLineMessages(session.lineUserId, followUpMessages, {
    force: true,
    logAs: "bot",
  });
  if (!pushed.sent) {
    console.warn("[line-guest-flow] push after LIFF pick failed", pushed);
  }
  return {
    ok: true,
    confirmText,
    followUpMessages,
    pushSent: pushed.sent,
  };
}

export async function getGuestSessionForLiff(sessionId: string) {
  const session = await getGuestSessionById(sessionId);
  if (!session) return null;
  const listings = await loadRentListings();
  const criteria = emptyCriteria();
  criteria.cities = session.cities;
  criteria.districts = session.districts;
  criteria.rooms = session.rooms;
  criteria.priceKeys = session.priceKeys;
  criteria.extras = session.extras;
  const matched = matchRentals(listings, criteria);
  return { session, listings: matched.items.slice(0, 12), relaxed: matched.relaxed };
}
