/** 方案 3：LINE 對話問條件 → LIFF 選房＋時間 → LINE 續問個資 */

import { ListingType } from "@prisma/client";
import {
  createGuestSession,
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
  toRentalMatchListing,
  type RentalExtra,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import {
  buildPublicBaseUrl,
  pushLineMessages,
  replyLineMessages,
  type LineMessage,
  type LineMessageAction,
} from "@/lib/line-messaging";
import { appendLineRentalCase } from "@/lib/line-rental-cases";
import { notifyAgentsOfNewViewing } from "@/lib/line-viewing-agent";
import { prisma } from "@/lib/prisma";

const ROOM_OPTS = [
  { id: "1", label: "1 房" },
  { id: "2", label: "2 房" },
  { id: "3", label: "3 房" },
  { id: "4", label: "4 房以上" },
];

const WELCOME =
  "您好～請問最近有在找房子嗎？如果有需要找房子可以點選「 開始找房 」，點選您要的需求就可以推薦您合適的房源哦！";

function qr(actions: LineMessageAction[]): LineMessage["quickReply"] {
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
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await prisma.listing.findMany({
      where: { listingType: ListingType.RENT, isPublished: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return rows.map(toRentalMatchListing);
  } catch (error) {
    console.error("[line-guest-flow] loadRentListings", error);
    return [];
  }
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

async function finishCase(session: GuestSession) {
  const criteria = emptyCriteria();
  criteria.cities = session.cities;
  criteria.districts = session.districts;
  criteria.rooms = session.rooms;
  criteria.priceKeys = session.priceKeys;
  criteria.extras = session.extras;
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
    text: `${summary}\n電話：${session.phone}\n我們會再跟你確認看屋時間，謝謝！`,
  };
}

export async function startGuestFlow(input: {
  replyToken: string;
  lineUserId: string;
  displayName?: string;
}) {
  const session = await createGuestSession({
    lineUserId: input.lineUserId,
    displayName: input.displayName,
  });
  const listings = await loadRentListings();
  await replyLineMessages(input.replyToken, [
    { type: "text", text: WELCOME },
    ...promptForStep(session, listings),
  ]);
}

export async function handleGuestText(input: {
  replyToken: string;
  lineUserId: string;
  text: string;
  displayName?: string;
}): Promise<boolean> {
  const text = input.text.trim();
  if (!text) return false;

  if (/^開始找房$/.test(text) || text.includes("開始找房")) {
    await startGuestFlow(input);
    return true;
  }

  const session = await getGuestSessionByUserId(input.lineUserId);
  if (!session) return false;

  const listings = await loadRentListings();

  if (session.step === "pet") {
    session.petNote = text;
    session.step = "awaiting_liff";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, openLiffMessage(session));
    return true;
  }

  if (session.step === "awaiting_liff") {
    await replyLineMessages(input.replyToken, openLiffMessage(session));
    return true;
  }

  if (session.step === "people") {
    const n = Number.parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      await replyLineMessages(input.replyToken, [
        { type: "text", text: "請回覆 1–20 的數字。" },
        askPeople(),
      ]);
      return true;
    }
    session.peopleCount = n;
    session.step = "occupation";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askOccupation()]);
    return true;
  }

  if (session.step === "occupation") {
    session.occupation = text.slice(0, 80);
    session.step = "moveIn";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askMoveIn()]);
    return true;
  }

  if (session.step === "moveIn") {
    session.moveInDate = text.slice(0, 40);
    session.step = "nationality";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askNationality()]);
    return true;
  }

  if (session.step === "nationality") {
    session.nationality = text.slice(0, 40);
    session.step = "phone";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askPhone()]);
    return true;
  }

  if (session.step === "phone") {
    const phone = text.replace(/\s/g, "");
    if (!/^09\d{8}$/.test(phone) && !/^0\d{8,12}$/.test(phone)) {
      await replyLineMessages(input.replyToken, [
        { type: "text", text: "請留下有效電話（例如 0912345678）。" },
        askPhone(),
      ]);
      return true;
    }
    session.phone = phone;
    const done = await finishCase(session);
    await replyLineMessages(input.replyToken, [done]);
    return true;
  }

  // 多選步驟若打字，提示用按鈕
  if (["city", "district", "rooms", "price", "extras"].includes(session.step)) {
    await replyLineMessages(input.replyToken, [
      { type: "text", text: "請用下方按鈕選擇，選完按「下一步」。" },
      ...promptForStep(session, listings),
    ]);
    return true;
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
  const listings = await loadRentListings();
  let session = await getGuestSessionByUserId(input.lineUserId);

  if (input.data === "guest:start") {
    await startGuestFlow(input);
    return true;
  }

  if (!session) {
    await startGuestFlow(input);
    return true;
  }

  const parts = input.data.split(":");
  // guest:toggle:city:台北市
  // guest:clear:city
  // guest:next:city
  // guest:pet:none
  // guest:people:2
  // guest:nationality:台灣

  if (parts[1] === "toggle" && parts[2] && parts[3]) {
    const field = parts[2];
    const value = parts.slice(3).join(":");
    if (field === "city") session.cities = toggle(session.cities, value);
    if (field === "district") session.districts = toggle(session.districts, value);
    if (field === "rooms") session.rooms = toggle(session.rooms, value);
    if (field === "price") session.priceKeys = toggle(session.priceKeys, value);
    if (field === "extras" && (value === "subsidy" || value === "tax" || value === "household")) {
      session.extras = toggle(session.extras, value) as RentalExtra[];
    }
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, promptForStep(session, listings));
    return true;
  }

  if (parts[1] === "clear" && parts[2]) {
    const field = parts[2];
    if (field === "city") {
      session.cities = [];
      session.districts = [];
    }
    if (field === "district") session.districts = [];
    if (field === "rooms") session.rooms = [];
    if (field === "price") session.priceKeys = [];
    if (field === "extras") session.extras = [];
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, promptForStep(session, listings));
    return true;
  }

  if (parts[1] === "next" && parts[2]) {
    const from = parts[2] as GuestFlowStep;
    const order: GuestFlowStep[] = ["city", "district", "rooms", "price", "extras", "pet"];
    const idx = order.indexOf(from);
    if (idx >= 0 && session.step === from) {
      session.step = order[idx + 1] ?? "pet";
      await saveGuestSession(session);
    }
    await replyLineMessages(input.replyToken, promptForStep(session, listings));
    return true;
  }

  if (parts[1] === "pet" && parts[2] === "none") {
    session.petNote = "沒有";
    session.step = "awaiting_liff";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, openLiffMessage(session));
    return true;
  }

  if (parts[1] === "people" && parts[2]) {
    session.peopleCount = Number.parseInt(parts[2], 10) || 1;
    session.step = "occupation";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askOccupation()]);
    return true;
  }

  if (parts[1] === "nationality" && parts[2]) {
    session.nationality = parts.slice(2).join(":") || "台灣";
    session.step = "phone";
    await saveGuestSession(session);
    await replyLineMessages(input.replyToken, [askPhone()]);
    return true;
  }

  return true;
}

/** LIFF 選完物件＋時間後呼叫 */
export async function completeGuestLiffPick(input: {
  sessionId: string;
  picked: { id: string; title: string; price: number }[];
  requestedWhen: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getGuestSessionById(input.sessionId);
  if (!session) return { ok: false, error: "找不到找房進度，請在 LINE 重新開始找房" };
  if (!input.picked.length) return { ok: false, error: "請至少選一間物件" };
  if (!input.requestedWhen.trim()) return { ok: false, error: "請選擇看屋時間" };

  session.picked = input.picked;
  session.requestedWhen = input.requestedWhen.trim();
  session.step = "people";
  await saveGuestSession(session);

  await pushLineMessages(session.lineUserId, [
    {
      type: "text",
      text: `已收到你選的物件與時間（${session.requestedWhen}）。接著再問幾題基本資料。`,
    },
    askPeople(),
  ]);
  return { ok: true };
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
