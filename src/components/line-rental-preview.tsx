"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";
import { formatViewingRange, RENT_PRICE_OPTIONS, type RentalMatchListing } from "@/lib/line-rental-assistant";
import type {
  LineConversation,
  LineConversationMediaType,
} from "@/lib/line-conversations";
import type { LineRentalCase } from "@/lib/line-rental-cases";
import type { GuestSession } from "@/lib/line-guest-sessions";
import type { GuestWatchRecord } from "@/lib/line-guest-watch";
import {
  buildViewingConfirmedGuestText,
  VIEWING_ASK_OTHER_TIME_TEXT,
  VIEWING_SUBMIT_ACK_TEXT,
  type ViewingConfirmListing,
} from "@/lib/line-viewing-guest-copy";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";
import {
  LINE_CS_STICKER_PACKS,
  stickerPreviewUrl,
  type LineCsSticker,
} from "@/lib/line-cs-stickers";

type GuestStatus =
  | "selecting"
  | "picking_time"
  | "pending_confirm"
  | "reschedule_sent"
  | "confirmed"
  | "saved"
  | "replied"
  | "awaiting_staff"
  | "awaiting_agent"
  | "agent_proposing";

type ListFilter = "all" | "active" | "pending" | "confirmed";
type PipelineBucket = "active" | "pending" | "confirmed" | "none";
type ReplyStatus = "awaiting_staff" | "replied";

type ChatLine = {
  id: string | number;
  from: "guest" | "bot" | "staff";
  text: string;
  at?: string;
  /** 原始時間，名單用「昨天／星期／日期」；氣泡仍用 at 的時分 */
  atIso?: string;
  messageId?: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
  /** 已顯示在對話裡、尚未被伺服器快照收下 */
  pending?: boolean;
};

type PickedListing = { id: string; title: string; price: number };

type FollowAsk = { listingId: string; title: string; answer: "pending" | "yes" | "no" };

type StaffGuest = {
  id: string;
  lineUserId?: string;
  caseId?: string;
  lineName: string;
  /** LINE 頭像網址；空字串代表已查過但沒有圖 */
  pictureUrl?: string;
  /** 帶看／表單流程狀態（右側處理面板用） */
  status: GuestStatus;
  /** 列表徽章：待回覆＝未回；已回覆＝已回 */
  replyStatus: ReplyStatus;
  /** 上方分頁：進行中／待確認／已確認 */
  pipeline: PipelineBucket;
  watching: boolean;
  criteriaText: string;
  /** 無配對時登記的最新找房條件 */
  watchCriteriaText?: string;
  /** 已有完整個資（電話等），可略過重填 */
  profileSaved?: boolean;
  /** 列表預覽用 */
  summaryText: string;
  createdAt: string;
  /** LINE 加好友時間（有 webhook follow 才有） */
  followedAt?: string;
  unfollowedAt?: string;
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  picked: PickedListing[];
  requestedWhen: string;
  proposedWhen: string;
  lines: ChatLine[];
  asks: FollowAsk[];
};

function formatLineClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });
}

const WEEKDAY_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

function taipeiYmd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function taipeiWeekday(date: Date): string {
  const ymd = taipeiYmd(date);
  const [year, month, day] = ymd.split("-").map(Number);
  const index = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return WEEKDAY_ZH[index] ?? "";
}

/** 名單右側：今天顯示時間、昨天、一週內顯示星期、更早顯示月/日 */
function formatLineListStamp(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = taipeiYmd(now);
  const target = taipeiYmd(date);
  if (target === today) return formatLineClock(iso);
  const [ty, tm, td] = today.split("-").map(Number);
  const [y, m, d] = target.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(ty, (tm ?? 1) - 1, td ?? 1) - Date.UTC(y, (m ?? 1) - 1, d ?? 1)) / 86400000,
  );
  if (diff === 1) return "昨天";
  if (diff > 1 && diff < 7) return taipeiWeekday(date);
  return `${m}/${d}`;
}

function formatLineDayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Taipei",
  });
}

function inferMediaType(line: ChatLine): LineConversationMediaType | undefined {
  if (line.mediaType) return line.mediaType;
  if (!line.messageId || !/^\d+$/.test(line.messageId)) return undefined;
  if (line.text === "［圖片］") return "image";
  if (line.text === "［影片］") return "video";
  if (line.text === "［語音］") return "audio";
  if (line.text === "［貼圖］") return "sticker";
  if (line.text.startsWith("［檔案］")) return "file";
  return undefined;
}

function stickerImageUrl(stickerId: string, animated = false) {
  const file = animated ? "sticker_animation.png" : "sticker.png";
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(stickerId)}/android/${file}`;
}

function StickerImage({ stickerId }: { stickerId: string }) {
  const [variant, setVariant] = useState<"still" | "animated" | "text">("still");
  if (variant === "text") return <span className="text-zinc-600">［貼圖］</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stickerImageUrl(stickerId, variant === "animated")}
      alt="貼圖"
      className="h-28 w-28 object-contain"
      loading="lazy"
      onError={() => setVariant(variant === "still" ? "animated" : "text")}
    />
  );
}

function lineContentUrl(messageId: string) {
  return `/api/line/message-content/${encodeURIComponent(messageId)}`;
}

/** 文字＋貼圖／圖片／影片預覽，接近 LINE 對話顯示 */
function LineMessageBody({ line }: { line: ChatLine }) {
  const mediaType = inferMediaType(line);

  if (mediaType === "sticker" && line.stickerId) {
    return <StickerImage stickerId={line.stickerId} />;
  }

  if (mediaType === "image" && line.messageId) {
    const href = /^(https?:|blob:)/i.test(line.messageId)
      ? line.messageId
      : /^\d+$/.test(line.messageId)
        ? lineContentUrl(line.messageId)
        : null;
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt="圖片"
            className="max-h-64 max-w-full rounded-lg object-contain"
            loading="lazy"
          />
        </a>
      );
    }
  }

  if (mediaType === "video" && line.messageId) {
    const href = /^(https?:|blob:)/i.test(line.messageId)
      ? line.messageId
      : /^\d+$/.test(line.messageId)
        ? lineContentUrl(line.messageId)
        : null;
    if (href) {
      return (
        <video
          src={href}
          controls
          playsInline
          className="max-h-64 max-w-full rounded-lg bg-black"
        />
      );
    }
  }

  if (mediaType === "audio" && line.messageId && /^\d+$/.test(line.messageId)) {
    return <audio src={lineContentUrl(line.messageId)} controls className="w-full max-w-[16rem]" />;
  }

  if (mediaType === "file" && line.messageId && /^\d+$/.test(line.messageId)) {
    return (
      <a
        href={lineContentUrl(line.messageId)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[#5179ad] underline"
      >
        {line.text || "［檔案］"}
      </a>
    );
  }

  if (mediaType === "sticker") {
    return <span className="text-zinc-600">［貼圖］</span>;
  }

  const text = line.text.replace(/\s+$/u, "");
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${index}-${part.slice(0, 24)}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[#5179ad] underline"
          >
            {part}
          </a>
        ) : (
          <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>
        ),
      )}
    </>
  );
}

const STATUS_LABEL: Record<GuestStatus, string> = {
  selecting: "進行中",
  picking_time: "進行中",
  pending_confirm: "待確認",
  reschedule_sent: "待客人確認改約",
  confirmed: "已確認",
  saved: "進行中",
  replied: "已回覆",
  awaiting_staff: "待回覆",
  awaiting_agent: "待業務確認",
  agent_proposing: "業務改約中",
};

/** 未回覆＝客人最後發言；已回覆＝客服／機器人已回（列表只在未回覆時顯示藍點） */
function resolveReplyStatus(lines: ChatLine[]): ReplyStatus {
  const last = lines[lines.length - 1];
  if (!last || last.from === "guest") return "awaiting_staff";
  return "replied";
}

/**
 * 進行中：還在填表單
 * 待確認：看屋時間尚未向業務確認
 * 已確認：時間與物件都安排好
 */
function resolvePipeline(input: {
  status: GuestStatus;
  formInProgress?: boolean;
  pickedCount: number;
  hasWhen: boolean;
}): PipelineBucket {
  if (input.formInProgress) return "active";
  if (
    input.status === "selecting" ||
    input.status === "picking_time" ||
    input.status === "saved"
  ) {
    return "active";
  }
  if (
    input.status === "pending_confirm" ||
    input.status === "reschedule_sent" ||
    input.status === "awaiting_agent" ||
    input.status === "agent_proposing"
  ) {
    return "pending";
  }
  if (input.status === "confirmed" && input.pickedCount > 0 && input.hasWhen) {
    return "confirmed";
  }
  if (input.status === "confirmed") return "confirmed";
  return "none";
}

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "active", label: "進行中" },
  { id: "pending", label: "待確認" },
  { id: "confirmed", label: "已確認" },
];

function formatRent(price: number) {
  return `${price.toLocaleString("zh-TW")} 元/月`;
}

function pickedOf(listing: RentalMatchListing | undefined): PickedListing[] {
  if (!listing) return [];
  return [{ id: listing.id, title: listing.title, price: listing.price }];
}

function criteriaFrom(listing: RentalMatchListing | undefined, fallback: string) {
  if (!listing) return fallback;
  const extras = [
    listing.rentSubsidy ? "租屋補助" : "",
    listing.taxDeductible ? "報稅" : "",
    listing.canRegisterAddress ? "簽戶籍" : "",
  ].filter(Boolean);
  const parking = listing.areaParkingSpace && listing.areaParkingSpace > 0 ? "要車位" : "車位不限";
  return [
    listing.city,
    listing.district,
    `${listing.rooms} 房`,
    `${listing.bathrooms} 衛`,
    parking,
    extras.length ? extras.join("、") : "補助／報稅／戶籍不限",
  ].join(" · ");
}

function listingLabel(listing: RentalMatchListing | undefined) {
  if (!listing) return "已上架出租物件";
  return `${listing.title}（${listing.district}，${formatRent(listing.price)}）`;
}

const WELCOME =
  "你好，我是租屋助理。點開始找房，每題都可以複選，再從網站上已上架的出租物件配對。看屋時間要等同事確認。";

function roomChoice(rooms: number) {
  return rooms >= 4 ? "4 房以上" : `${rooms} 房`;
}

function bathChoice(bathrooms: number) {
  return bathrooms <= 1 ? "1 衛" : "2 衛以上";
}

function priceChoice(price: number) {
  return RENT_PRICE_OPTIONS.find((option) => price >= option.min && price <= option.max)?.label ?? "月租不限";
}

function extraChoice(listing: RentalMatchListing) {
  const extras = [
    listing.rentSubsidy ? "租屋補助" : "",
    listing.taxDeductible ? "報稅" : "",
    listing.canRegisterAddress ? "簽戶籍" : "",
  ].filter(Boolean);
  return extras.length ? extras.join("、") : "不限";
}

/** 從開場補到客人最後填完的那一步，中間不省略。 */
function fullThread(
  listing: RentalMatchListing | undefined,
  stop: "district" | "time" | "booked" | "declined",
  extra?: { name?: string; when?: string; staff?: string; pet?: string },
): ChatLine[] {
  const lines: ChatLine[] = [];
  const add = (from: ChatLine["from"], text: string) => {
    lines.push({ id: lines.length + 1, from, text });
  };
  const city = listing?.city || "台北市";
  add("bot", WELCOME);
  add("guest", "開始找房");
  add("bot", "有沒有養寵物？有的話跟我說是什麼寵物；沒有就回「沒有」。");
  add("guest", extra?.pet ?? "沒有");
  add("bot", "想看哪些縣市？可複選，沒勾就是不限。");
  add("guest", city);
  add("bot", "哪些行政區？可複選，沒勾就是不限。");
  if (stop === "district") return lines;

  add("guest", listing?.district || "行政區不限");
  add("bot", "需要幾房？可複選。");
  add("guest", listing ? roomChoice(listing.rooms) : "房數不限");
  add("bot", "衛浴呢？可複選，沒勾就是不限。");
  add("guest", listing ? bathChoice(listing.bathrooms) : "衛浴不限");
  add("bot", "車位呢？可複選，沒勾或兩個都勾就是不限。");
  add("guest", listing?.areaParkingSpace && listing.areaParkingSpace > 0 ? "要車位" : "車位不限");
  add("bot", "月租大概哪些區間？可複選，沒勾就是不限。");
  add("guest", listing ? priceChoice(listing.price) : "月租不限");
  add("bot", "租屋補助、報稅、簽戶籍？可複選，沒勾就是不限。");
  add("guest", listing ? extraChoice(listing) : "不限");
  add(
    "bot",
    "找到符合的物件。一次看 3 間，想看幾間都可以勾。之後官網若有新的符合物件，會再傳給你，問要不要看。",
  );

  if (stop === "declined") {
    add("bot", `官網有一間新物件符合你的條件：${listingLabel(listing)}。要看這間嗎？`);
    add("guest", "先不用");
    add("bot", "好，之後官網再有符合的，我會再問你。");
    return lines;
  }

  add("guest", `我想看：${listing?.title ?? "已上架物件"}`);
  add("bot", "想哪一天、哪個時段看屋？先選日期，再在時間軸點希望開始時間（每格 15 分）。這還不是確定的預約。");
  if (stop === "time") return lines;

  add("guest", extra?.when ?? "");
  add(
    "bot",
    `${extra?.name ?? "你"}，已記下想看的物件和希望時間，時間尚未確認。同事會再跟業務或屋主對過，確認後在 LINE 回你。`,
  );
  if (extra?.staff) add("staff", extra.staff);
  return lines;
}

function attachPipelineAndReply(
  guest: Omit<
    StaffGuest,
    | "replyStatus"
    | "pipeline"
    | "phone"
    | "occupation"
    | "nationality"
    | "peopleCount"
    | "petNote"
    | "moveInDate"
  > &
    Partial<
      Pick<
        StaffGuest,
        | "replyStatus"
        | "pipeline"
        | "phone"
        | "occupation"
        | "nationality"
        | "peopleCount"
        | "petNote"
        | "moveInDate"
      >
    >,
  formInProgress = false,
): StaffGuest {
  const replyStatus = guest.replyStatus ?? resolveReplyStatus(guest.lines);
  const pipeline =
    guest.pipeline ??
    resolvePipeline({
      status: guest.status,
      formInProgress,
      pickedCount: guest.picked.length,
      hasWhen: Boolean(guest.requestedWhen || guest.proposedWhen),
    });
  return {
    ...guest,
    phone: guest.phone || "",
    occupation: guest.occupation || "",
    nationality: guest.nationality || "",
    peopleCount: guest.peopleCount || 1,
    petNote: guest.petNote || "",
    moveInDate: guest.moveInDate || "",
    replyStatus,
    pipeline,
  };
}

function serverAlreadyHas(serverLines: ChatLine[], pending: ChatLine, used: Set<ChatLine>) {
  const sent = pending.atIso ? Date.parse(pending.atIso) : 0;
  return serverLines.some((line) => {
    if (used.has(line) || line.from !== pending.from) return false;
    const at = line.atIso ? Date.parse(line.atIso) : 0;
    if (!Number.isFinite(at) || at < sent - 20000) return false;
    const same =
      pending.mediaType != null
        ? line.mediaType === pending.mediaType
        : line.text === pending.text;
    if (!same) return false;
    used.add(line);
    return true;
  });
}

/** 快照還沒寫入的送出訊息留在對話與列表，避免被同步蓋掉 */
function mergePendingStaffLines(live: StaffGuest[], local: StaffGuest[]): StaffGuest[] {
  const localById = new Map(local.map((guest) => [guest.id, guest]));
  const merged = live.map((guest) => {
    const pending = localById.get(guest.id)?.lines.filter((line) => line.pending) ?? [];
    if (!pending.length) return guest;
    const used = new Set<ChatLine>();
    const kept = pending.filter((line) => !serverAlreadyHas(guest.lines, line, used));
    for (const line of pending) {
      if (!kept.includes(line) && line.messageId?.startsWith("blob:")) {
        URL.revokeObjectURL(line.messageId);
      }
    }
    if (!kept.length) return guest;
    const lines = [...guest.lines, ...kept];
    const last = lines[lines.length - 1];
    const createdAt =
      last?.atIso && last.atIso > guest.createdAt ? last.atIso : guest.createdAt;
    return attachPipelineAndReply({
      ...guest,
      lines,
      summaryText: last?.text || guest.summaryText,
      createdAt,
      replyStatus: resolveReplyStatus(lines),
    });
  });
  return merged.sort((a, b) => {
    const aIso = a.lines[a.lines.length - 1]?.atIso || a.createdAt || "";
    const bIso = b.lines[b.lines.length - 1]?.atIso || b.createdAt || "";
    return bIso.localeCompare(aIso);
  });
}

function buildStaffGuests(listings: RentalMatchListing[]): StaffGuest[] {
  const first = listings[0];
  const second = listings[1] ?? listings[0];
  const third = listings[2] ?? listings[0];
  const firstPick = pickedOf(first);
  const secondPick = pickedOf(second);

  return [
    attachPipelineAndReply({
      id: "chen",
      lineName: "陳小姐",
      status: "selecting",
      watching: false,
      criteriaText: "沒有寵物 · 台北市 · 行政區還沒選",
      summaryText: "沒有寵物 · 台北市 · 行政區還沒選",
      createdAt: "2026-11-03T04:10:00.000Z",
      picked: [],
      requestedWhen: "",
      proposedWhen: "",
      asks: [],
      lines: fullThread(undefined, "district", { pet: "沒有" }),
    }),
    attachPipelineAndReply({
      id: "lin",
      lineName: "林先生",
      status: "picking_time",
      watching: true,
      criteriaText: `${criteriaFrom(first, "新北市 · 板橋區 · 2 房 · 要車位")} · 有，一隻貓`,
      summaryText: `${criteriaFrom(first, "新北市 · 板橋區 · 2 房 · 要車位")} · 有，一隻貓`,
      createdAt: "2026-11-03T04:20:00.000Z",
      picked: firstPick,
      requestedWhen: "",
      proposedWhen: "",
      asks: [],
      lines: fullThread(first, "time", { pet: "有，一隻貓" }),
    }),
    attachPipelineAndReply({
      id: "wang",
      lineName: "王先生",
      status: "pending_confirm",
      watching: true,
      criteriaText: `${criteriaFrom(second, "台北市 · 中山區 · 2 房")} · 沒有寵物`,
      summaryText: [
        "【找房預約】我想看以下物件，請協助確認時間。",
        "",
        "看屋時間：2026/11/03 下午 13:00–17:00",
        `條件：${criteriaFrom(second, "台北市 · 中山區 · 2 房")} · 沒有寵物`,
      ].join("\n"),
      createdAt: "2026-11-03T05:00:00.000Z",
      picked: secondPick,
      requestedWhen: "2026/11/03 下午 13:00–17:00",
      proposedWhen: "",
      asks: second ? [{ listingId: second.id, title: second.title, answer: "yes" }] : [],
      lines: fullThread(second, "booked", {
        name: "王先生",
        when: "2026/11/03 下午 13:00–17:00",
        pet: "沒有",
      }),
    }),
    attachPipelineAndReply({
      id: "zhang",
      lineName: "張小姐",
      status: "saved",
      watching: true,
      criteriaText: `${criteriaFrom(third, "台北市 · 1 房 · 租屋補助")} · 有，小型犬`,
      summaryText: `${criteriaFrom(third, "台北市 · 1 房 · 租屋補助")} · 有，小型犬`,
      createdAt: "2026-11-03T05:30:00.000Z",
      picked: [],
      requestedWhen: "",
      proposedWhen: "",
      asks: third ? [{ listingId: third.id, title: third.title, answer: "no" }] : [],
      lines: fullThread(third, "declined", { pet: "有，小型犬" }),
    }),
    attachPipelineAndReply({
      id: "huang",
      lineName: "黃先生",
      status: "confirmed",
      watching: true,
      criteriaText: `${criteriaFrom(first, "新北市 · 3 房 · 要車位 · 簽戶籍")} · 沒有寵物`,
      summaryText: [
        "【找房預約】我想看以下物件，請協助確認時間。",
        "",
        "看屋時間：2026/10/30 上午 9:00–12:00",
        `條件：${criteriaFrom(first, "新北市 · 3 房 · 要車位 · 簽戶籍")} · 沒有寵物`,
      ].join("\n"),
      createdAt: "2026-10-30T01:00:00.000Z",
      picked: firstPick,
      requestedWhen: "2026/10/30 上午 9:00–12:00",
      proposedWhen: "",
      asks: [],
      lines: fullThread(first, "booked", {
        name: "黃先生",
        when: "2026/10/30 上午 9:00–12:00",
        pet: "沒有",
        staff: "2026/10/30 上午 9:00–12:00 可以幫您安排帶看～\n\n直接到這邊就可以嘍～感謝您。",
      }),
    }),
  ];
}

function caseToStaffGuest(item: LineRentalCase): StaffGuest {
  const createdAt = item.createdAt || new Date().toISOString();
  const clock = formatLineClock(createdAt);
  const lines: ChatLine[] = [];
  const add = (from: ChatLine["from"], text: string) => {
    if (!text) return;
    lines.push({ id: lines.length + 1, from, text, at: clock });
  };

  const lineMessage =
    item.summaryText?.trim() ||
    [
      item.criteriaText,
      item.picked.length ? `想看：${item.picked.map((p) => p.title).join("、")}` : "",
      item.requestedWhen ? `看屋時間：${item.requestedWhen}` : "",
      item.phone ? `電話：${item.phone}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  if (item.kind === "591_link") {
    add("guest", item.guestMessage || item.source591Url || item.source591Id || "591 連結");
    if (lineMessage) add("guest", lineMessage);
  } else if (item.kind === "image_inquiry") {
    add("guest", "［圖片］");
    if (lineMessage) add("guest", lineMessage);
  } else {
    // 與真實 LINE 對話一致：客人端送出的整段原文（單則氣泡）
    add("guest", lineMessage || "（客人已送出找房預約）");
  }
  if (item.proposedWhen) add("staff", `業務提案時間：${item.proposedWhen}`);

  const status: GuestStatus =
    item.status === "awaiting_staff"
      ? "awaiting_staff"
      : item.status === "awaiting_agent"
        ? "awaiting_agent"
        : item.status === "agent_proposing"
          ? "agent_proposing"
          : item.status === "reschedule_sent"
            ? "reschedule_sent"
            : item.status === "confirmed"
              ? "confirmed"
              : "pending_confirm";

  const criteriaBits = [
    item.kind === "591_link" ? "591 詢問" : item.kind === "image_inquiry" ? "圖片詢問" : item.criteriaText,
    item.source591Id ? `#${item.source591Id}` : "",
    item.phone ? `電話 ${item.phone}` : "",
  ].filter(Boolean);

  return attachPipelineAndReply({
    id: item.lineUserId || item.id,
    lineUserId: item.lineUserId || undefined,
    caseId: item.id,
    lineName: item.displayName || "LINE 客人",
    status,
    watching: true,
    criteriaText: criteriaBits.join(" · ") || item.criteriaText,
    summaryText: lineMessage,
    createdAt,
    phone: item.phone || "",
    occupation: item.occupation || "",
    nationality: item.nationality || "",
    peopleCount: item.peopleCount || 1,
    petNote: item.petNote || "",
    moveInDate: item.moveInDate || "",
    picked: item.picked,
    requestedWhen: item.requestedWhen,
    proposedWhen: item.proposedWhen || "",
    asks: [],
    lines,
  });
}

function watchSummary(watch: GuestWatchRecord) {
  const budget =
    watch.priceMin != null || watch.priceMax != null
      ? `自訂預算 ${watch.priceMin ?? "不限"}～${watch.priceMax ?? "不限"}`
      : "";
  const pet = watch.petNote ? `寵物：${watch.petNote}` : "";
  return [watch.criteriaText, budget, pet].filter(Boolean).join(" · ");
}

function buildLiveGuests(
  conversations: LineConversation[],
  cases: LineRentalCase[],
  openSessions: GuestSession[] = [],
  watches: GuestWatchRecord[] = [],
  profileUserIds: string[] = [],
): StaffGuest[] {
  const formInProgressIds = new Set(
    openSessions.map((session) => session.lineUserId).filter(Boolean),
  );
  const watchByUser = new Map(watches.map((watch) => [watch.lineUserId, watch]));
  const profileIds = new Set(profileUserIds);
  const fromConversations = conversations.map((item) => {
    const guest = conversationToStaffGuest(item, cases, formInProgressIds);
    const watch = item.lineUserId ? watchByUser.get(item.lineUserId) : undefined;
    if (!watch && !profileIds.has(item.lineUserId)) return guest;
    const summary = watch ? watchSummary(watch) : "";
    return {
      ...guest,
      watching: watch ? watch.active : guest.watching,
      watchCriteriaText: summary || undefined,
      criteriaText: summary || guest.criteriaText,
      petNote: watch?.petNote || guest.petNote,
      profileSaved: profileIds.has(item.lineUserId),
    };
  });
  const covered = new Set(
    fromConversations.map((item) => item.lineUserId).filter(Boolean) as string[],
  );
  const orphans = cases
    .filter((item) => item.lineUserId && !covered.has(item.lineUserId))
    .map(caseToStaffGuest);
  return [...fromConversations, ...orphans];
}

function conversationToStaffGuest(
  conversation: LineConversation,
  cases: LineRentalCase[],
  formInProgressIds?: Set<string>,
): StaffGuest {
  const related = cases
    .filter((item) => item.lineUserId === conversation.lineUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = related[0] ?? null;
  const base = latest ? caseToStaffGuest(latest) : null;
  const formInProgress = Boolean(formInProgressIds?.has(conversation.lineUserId));

  const lines: ChatLine[] = conversation.messages.map((message) => ({
    id: message.id,
    from: message.from === "guest" ? "guest" : message.from === "staff" ? "staff" : "bot",
    text: message.text,
    at: formatLineClock(message.createdAt),
    atIso: message.createdAt,
    messageId: message.messageId,
    mediaType: message.mediaType,
    stickerId: message.stickerId,
    packageId: message.packageId,
  }));

  const lastGuestText =
    [...conversation.messages].reverse().find((m) => m.from === "guest")?.text ||
    base?.summaryText ||
    "";

  const resolvedLines =
    lines.length > 0
      ? lines
      : base?.lines ?? [
          {
            id: 1,
            from: "guest" as const,
            text: lastGuestText || "（尚無訊息）",
            at: formatLineClock(conversation.updatedAt),
            atIso: conversation.updatedAt,
          },
        ];

  const workflowStatus: GuestStatus =
    base?.status ?? (formInProgress ? "selecting" : "awaiting_staff");

  return attachPipelineAndReply(
    {
      id: conversation.lineUserId,
      lineUserId: conversation.lineUserId,
      caseId: latest?.id,
      lineName: conversation.displayName || base?.lineName || "LINE 客人",
      pictureUrl: conversation.pictureUrl,
      status: workflowStatus,
      watching: true,
      criteriaText: base?.criteriaText || "",
      summaryText: lastGuestText,
      createdAt: conversation.updatedAt || base?.createdAt || new Date().toISOString(),
      followedAt: conversation.followedAt,
      unfollowedAt: conversation.unfollowedAt,
      phone: base?.phone || "",
      occupation: base?.occupation || "",
      nationality: base?.nationality || "",
      peopleCount: base?.peopleCount || 1,
      petNote: base?.petNote || "",
      moveInDate: base?.moveInDate || "",
      picked: base?.picked ?? [],
      requestedWhen: base?.requestedWhen ?? "",
      proposedWhen: base?.proposedWhen ?? "",
      asks: [],
      lines: resolvedLines,
    },
    formInProgress,
  );
}

function matchesFilter(guest: StaffGuest, filter: ListFilter) {
  if (filter === "all") return true;
  return guest.pipeline === filter;
}

function LineSideAvatar({
  name,
  src,
  size = "sm",
  className = "",
}: {
  name: string;
  src?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1) || "客";
  const box = size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
  if (src && !failed) {
    return (
      // LINE profile.line-scdn.net 不走 next/image，避免網域設定擋住頭像
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-[#06c755] font-bold text-white ${className}`}
    >
      {initial}
    </span>
  );
}

export function LineRentalPreview({
  listings,
  lineBasicId,
  staffDisplayName,
  initialConversations = [],
  initialCases = [],
  initialSessions = [],
  initialWatches = [],
  initialProfileUserIds = [],
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
  staffDisplayName: string;
  initialConversations?: LineConversation[];
  initialCases?: LineRentalCase[];
  initialSessions?: GuestSession[];
  initialWatches?: GuestWatchRecord[];
  initialProfileUserIds?: string[];
}) {
  const demoGuests = useMemo(() => buildStaffGuests(listings), [listings]);
  const seedLive = useMemo(
    () =>
      buildLiveGuests(
        initialConversations,
        initialCases,
        initialSessions,
        initialWatches,
        initialProfileUserIds,
      ),
    [initialConversations, initialCases, initialSessions, initialWatches, initialProfileUserIds],
  );
  const [liveReady, setLiveReady] = useState(() => seedLive.length > 0);
  const [liveGuests, setLiveGuests] = useState<StaffGuest[]>(() => seedLive);
  const [guests, setGuests] = useState<StaffGuest[]>(() => (seedLive.length ? seedLive : []));
  const [filter, setFilter] = useState<ListFilter>("all");
  const [selectedId, setSelectedId] = useState(() => seedLive[0]?.id ?? "");
  /** 手機：列表與對話分開全螢幕；桌機三欄不受這個狀態影響 */
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [editingTime, setEditingTime] = useState(false);
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notifyState, setNotifyState] = useState<"default" | "granted" | "denied" | "unsupported">(
    "default",
  );
  const [stickerOpen, setStickerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [stickerPackId, setStickerPackId] = useState(LINE_CS_STICKER_PACKS[0]?.packageId ?? "");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const lineId = useRef(500);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastThreadKeyRef = useRef("");
  const knownGuestMsgKeysRef = useRef<Set<string> | null>(null);
  const pageTitleRef = useRef("");
  /** 送出後短暫忽略 onChange，避免 IME／Enter 把字又填回來 */
  const ignoreDraftChangeRef = useRef<string | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const desktopDraftRef = useRef<HTMLTextAreaElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  const today = useMemo(() => taipeiTodayYmd(), []);

  function resizeDraftInput(node?: HTMLTextAreaElement | null) {
    const el =
      node ??
      [draftInputRef.current, desktopDraftRef.current].find(
        (item) => item && item.getClientRects().length > 0,
      ) ??
      draftInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const max = 7 * 20; // 約 7 行
    const next = Math.max(el.scrollHeight, 40);
    el.style.height = `${Math.min(next, max)}px`;
  }

  useEffect(() => {
    pageTitleRef.current = document.title;
    if (typeof Notification === "undefined") {
      setNotifyState("unsupported");
      return;
    }
    setNotifyState(Notification.permission);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | null = null;
    let source: EventSource | null = null;

    function playNotifyBeep() {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        window.setTimeout(() => void ctx.close(), 300);
      } catch {
        /* ignore */
      }
    }

    function notifyNewGuestMessages(nextGuests: StaffGuest[]) {
      const nextKeys = new Set<string>();
      const fresh: Array<{ guestId: string; name: string; text: string }> = [];
      for (const guest of nextGuests) {
        for (const line of guest.lines) {
          if (line.from !== "guest") continue;
          const key = `${guest.id}:${String(line.id)}`;
          nextKeys.add(key);
          if (knownGuestMsgKeysRef.current && !knownGuestMsgKeysRef.current.has(key)) {
            fresh.push({
              guestId: guest.id,
              name: guest.lineName,
              text: line.text.replace(/\s+/g, " ").trim().slice(0, 120),
            });
          }
        }
      }

      // 第一次快照只建基準，不提醒（避免進頁就狂跳）
      if (!knownGuestMsgKeysRef.current) {
        knownGuestMsgKeysRef.current = nextKeys;
        return;
      }
      knownGuestMsgKeysRef.current = nextKeys;
      if (!fresh.length) return;

      const latest = fresh[fresh.length - 1];
      document.title = `（${fresh.length}）新訊息｜租屋配對客服`;
      playNotifyBeep();

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const popup = new Notification(latest.name || "LINE 客人", {
            body: latest.text || "傳了一則新訊息",
            tag: `line-cs-${latest.guestId}`,
          });
          popup.onclick = () => {
            window.focus();
            setSelectedId(latest.guestId);
            setMobilePane("chat");
            setFilter("all");
            popup.close();
          };
        } catch {
          /* ignore */
        }
      }
    }

    function applySnapshot(data: {
      conversations?: LineConversation[];
      cases?: LineRentalCase[];
      sessions?: GuestSession[];
      watches?: GuestWatchRecord[];
      profileUserIds?: string[];
    }) {
      if (cancelled) return;
      const next = buildLiveGuests(
        data.conversations ?? [],
        data.cases ?? [],
        data.sessions ?? [],
        data.watches ?? [],
        data.profileUserIds ?? [],
      );
      notifyNewGuestMessages(next);
      setLiveGuests(next);
      setLiveReady(true);
    }

    async function loadLiveOnce() {
      try {
        const response = await fetch(`/api/line/conversations?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        if (!response.ok) {
          if (!cancelled) setLiveReady(true);
          return;
        }
        const data = (await response.json()) as {
          conversations?: LineConversation[];
          cases?: LineRentalCase[];
          sessions?: GuestSession[];
          watches?: GuestWatchRecord[];
          profileUserIds?: string[];
        };
        applySnapshot(data);
      } catch {
        if (!cancelled) setLiveReady(true);
      }
    }

    function stopFallback() {
      if (fallbackTimer != null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function startFallback() {
      if (fallbackTimer != null) return;
      // SSE 失敗時才退回短輪詢
      fallbackTimer = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void loadLiveOnce();
      }, 1000);
    }

    function connectStream() {
      if (cancelled) return;
      source?.close();
      source = new EventSource("/api/line/conversations/stream");
      source.addEventListener("snapshot", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            conversations?: LineConversation[];
            cases?: LineRentalCase[];
            sessions?: GuestSession[];
            watches?: GuestWatchRecord[];
            profileUserIds?: string[];
          };
          applySnapshot(data);
          stopFallback();
        } catch {
          /* ignore */
        }
      });
      source.addEventListener("ready", () => {
        stopFallback();
      });
      source.onerror = () => {
        // 瀏覽器會自動重連；同時開短輪詢保底
        startFallback();
      };
    }

    void loadLiveOnce();
    connectStream();

    function onFocus() {
      void loadLiveOnce();
      if (!source || source.readyState === EventSource.CLOSED) connectStream();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        if (pageTitleRef.current) document.title = pageTitleRef.current;
        onFocus();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stopFallback();
      source?.close();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (pageTitleRef.current) document.title = pageTitleRef.current;
    };
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function enableDesktopNotify() {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifyState("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotifyState(permission);
    if (permission !== "granted") return;

    try {
      const keyRes = await fetch("/api/admin/push/vapid-public-key", { cache: "no-store" });
      if (!keyRes.ok) throw new Error("vapid key failed");
      const keyData = (await keyRes.json()) as { publicKey?: string };
      const publicKey = keyData.publicKey?.trim() || "";
      if (!publicKey) throw new Error("missing public key");

      const registration = await navigator.serviceWorker.register("/line-cs-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      const endpoint = json.endpoint || "";
      const p256dh = json.keys?.p256dh || "";
      const auth = json.keys?.auth || "";
      if (!endpoint || !p256dh || !auth) throw new Error("invalid subscription");

      const saveRes = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
        }),
      });
      if (!saveRes.ok) throw new Error("save subscription failed");
      setNotifyState("granted");
    } catch (error) {
      console.warn("[line-cs] enable push failed", error);
      // 仍保留頁面內通知；背景推播失敗時至少 permission 狀態正確
      setNotifyState(Notification.permission);
    }
  }

  useEffect(() => {
    // 伺服器對話為準，但送出後還沒寫進快照的那幾則要留在畫面上
    if (liveGuests.length) {
      setGuests((current) => mergePendingStaffLines(liveGuests, current));
      return;
    }
    // 尚未載入完成前不要塞示範客人，避免手機先閃假名單
    if (!liveReady) {
      setGuests([]);
      return;
    }
    setGuests(demoGuests);
  }, [liveGuests, demoGuests, liveReady]);

  useEffect(() => {
    if (!liveGuests.length) return;
    setSelectedId((current) => {
      if (liveGuests.some((g) => g.id === current)) return current;
      return liveGuests[0].id;
    });
  }, [liveGuests]);

  const visible = guests
    .filter((guest) => matchesFilter(guest, filter))
    .slice()
    .sort((a, b) => {
      const aIso = a.lines[a.lines.length - 1]?.atIso || a.createdAt || "";
      const bIso = b.lines[b.lines.length - 1]?.atIso || b.createdAt || "";
      return bIso.localeCompare(aIso);
    });
  const selected = visible.find((guest) => guest.id === selectedId) ?? visible[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    const threadKey = `${selected.id}:${selected.lines.length}:${selected.lines.at(-1)?.id ?? ""}`;
    if (threadKey === lastThreadKeyRef.current) return;
    lastThreadKeyRef.current = threadKey;
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [selected]);
  const draft = selected ? (drafts[selected.id] ?? "") : "";
  useEffect(() => {
    window.requestAnimationFrame(() => resizeDraftInput());
  }, [selectedId, draft]);
  const needsConfirm =
    (selected?.status === "pending_confirm" || selected?.status === "reschedule_sent") &&
    Boolean(selected.requestedWhen || selected.proposedWhen);

  function selectGuest(id: string) {
    setSelectedId(id);
    setMobilePane("chat");
    setEditingTime(false);
    setSchedule(emptyViewingSchedule());
    setDetailsOpen(false);
    setStickerOpen(false);
    setAttachOpen(false);
    setPresetOpen(false);
  }

  function patchGuest(id: string, update: (guest: StaffGuest) => StaffGuest) {
    setGuests((current) => current.map((guest) => (guest.id === id ? update(guest) : guest)));
  }

  function showOutgoing(guestId: string, line: ChatLine) {
    patchGuest(guestId, (current) =>
      attachPipelineAndReply({
        ...current,
        lines: [...current.lines, line],
        summaryText: line.text,
        createdAt: line.atIso || current.createdAt,
        replyStatus: "replied",
      }),
    );
  }

  function dropOutgoing(guestId: string, lineIdLocal: number) {
    patchGuest(guestId, (current) => {
      const removed = current.lines.find((line) => line.id === lineIdLocal);
      if (removed?.messageId?.startsWith("blob:")) URL.revokeObjectURL(removed.messageId);
      const lines = current.lines.filter((line) => line.id !== lineIdLocal);
      const last = lines[lines.length - 1];
      return attachPipelineAndReply({
        ...current,
        lines,
        summaryText: last?.text || current.summaryText,
        replyStatus: resolveReplyStatus(lines),
      });
    });
  }

  function pushStaffPayload(
    guest: StaffGuest,
    lineIdLocal: number,
    payload: {
      text?: string;
      sticker?: { packageId: string; stickerId: string };
      imageUrl?: string;
      videoUrl?: string;
      previewImageUrl?: string;
    },
  ) {
    if (!guest.lineUserId) return;
    void fetch("/api/line/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: guest.lineUserId, ...payload }),
    }).then(async (response) => {
      if (response.ok) return;
      dropOutgoing(guest.id, lineIdLocal);
      window.alert("傳送失敗，請再試一次");
    });
  }

  function pushStaffLine(guest: StaffGuest, text: string, lineIdLocal: number) {
    pushStaffPayload(guest, lineIdLocal, { text });
  }

  function focusListingPanel() {
    setDetailsOpen(true);
    setStickerOpen(false);
    window.requestAnimationFrame(() => {
      rightPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function sendSticker(guest: StaffGuest, sticker: LineCsSticker) {
    if (!guest.lineUserId) return;
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    showOutgoing(guest.id, {
      id,
      from: "staff",
      text: "［貼圖］",
      at,
      atIso: sentAt,
      mediaType: "sticker",
      stickerId: sticker.stickerId,
      packageId: sticker.packageId,
      pending: true,
    });
    setStickerOpen(false);
    pushStaffPayload(guest, id, {
      sticker: { packageId: sticker.packageId, stickerId: sticker.stickerId },
    });
  }

  async function uploadMediaFile(file: File) {
    const form = new FormData();
    form.append("files", file);
    const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: form });
    const uploadJson = (await uploadRes.json().catch(() => null)) as
      | { ok?: boolean; urls?: string[]; message?: string }
      | null;
    const url = uploadJson?.urls?.[0];
    if (!uploadRes.ok || !url) {
      throw new Error(uploadJson?.message || "上傳失敗");
    }
    return url;
  }

  async function videoPreviewFile(file: File): Promise<File | null> {
    const src = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = src;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("preview"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, 240, 240);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8),
      );
      if (!blob) return null;
      return new File([blob], "video-preview.jpg", { type: "image/jpeg" });
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  async function uploadAndSendMedia(guest: StaffGuest, file: File, kind: "image" | "video") {
    if (!guest.lineUserId) return;
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    const blobUrl = URL.createObjectURL(file);
    showOutgoing(guest.id, {
      id,
      from: "staff",
      text: kind === "video" ? "［影片］" : "［圖片］",
      at,
      atIso: sentAt,
      mediaType: kind,
      messageId: blobUrl,
      pending: true,
    });
    setUploadingMedia(true);
    try {
      const url = await uploadMediaFile(file);
      if (kind === "video") {
        const previewFile = await videoPreviewFile(file);
        const previewUrl = previewFile ? await uploadMediaFile(previewFile) : "";
        if (!previewUrl) throw new Error("影片預覽圖上傳失敗");
        pushStaffPayload(guest, id, { videoUrl: url, previewImageUrl: previewUrl });
      } else {
        pushStaffPayload(guest, id, { imageUrl: url });
      }
    } catch (error) {
      dropOutgoing(guest.id, id);
      window.alert(error instanceof Error ? error.message : "上傳失敗");
    } finally {
      setUploadingMedia(false);
    }
  }

  function onPickMedia(guest: StaffGuest, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      void uploadAndSendMedia(guest, file, "video");
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("請選擇圖片或影片");
      return;
    }
    void uploadAndSendMedia(guest, file, "image");
  }

  function listingBaseUrl() {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "";
  }

  function confirmListingsForGuest(
    guest: StaffGuest,
    orderedIds?: string[],
  ): ViewingConfirmListing[] {
    const base = listingBaseUrl();
    const order =
      orderedIds && orderedIds.length
        ? orderedIds
        : guest.picked.map((item) => item.id);
    const byId = new Map(guest.picked.map((item) => [item.id, item]));
    return order
      .map((id) => byId.get(id))
      .filter((item): item is PickedListing => Boolean(item))
      .map((item) => {
        const listing = listings.find((row) => row.id === item.id);
        const address =
          listing?.address?.trim() ||
          `${listing?.city || ""}${listing?.district || ""}`.trim() ||
          undefined;
        return {
          title: listing?.title?.trim() || item.title,
          pageUrl: `${base}/listings/${item.id}`,
          address,
        };
      });
  }

  function confirmTime(guest: StaffGuest, orderedIds?: string[]) {
    const when = guest.proposedWhen || guest.requestedWhen;
    const orderedPicked =
      orderedIds && orderedIds.length
        ? orderedIds
            .map((id) => guest.picked.find((item) => item.id === id))
            .filter((item): item is PickedListing => Boolean(item))
        : guest.picked;
    const text = buildViewingConfirmedGuestText(
      when,
      confirmListingsForGuest(guest, orderedIds),
    );
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    patchGuest(guest.id, (current) =>
      attachPipelineAndReply({
        ...current,
        status: "confirmed",
        requestedWhen: when,
        proposedWhen: "",
        picked: orderedPicked.length ? orderedPicked : current.picked,
        lines: [...current.lines, { id, from: "staff", text, at, atIso: sentAt, pending: true }],
        summaryText: text,
        createdAt: sentAt,
        replyStatus: "replied",
      }),
    );
    pushStaffLine(guest, text, id);
    setEditingTime(false);
  }

  /** 客服點「改時間」：直接請客人另提方便時段 */
  function askOtherTime(guest: StaffGuest) {
    const text = VIEWING_ASK_OTHER_TIME_TEXT;
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    patchGuest(guest.id, (current) =>
      attachPipelineAndReply({
        ...current,
        status: "reschedule_sent",
        proposedWhen: "",
        lines: [...current.lines, { id, from: "staff", text, at, atIso: sentAt, pending: true }],
        summaryText: text,
        createdAt: sentAt,
        replyStatus: "replied",
      }),
    );
    pushStaffLine(guest, text, id);
    setEditingTime(false);
    setSchedule(emptyViewingSchedule());
  }

  function sendNewTime(guest: StaffGuest) {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) return;
    // 客服另選時間後確認：與「可以這個時間」同句式，帶入新時間
    const text = buildViewingConfirmedGuestText(when, confirmListingsForGuest(guest));
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    patchGuest(guest.id, (current) =>
      attachPipelineAndReply({
        ...current,
        status: "confirmed",
        requestedWhen: when,
        proposedWhen: "",
        lines: [...current.lines, { id, from: "staff", text, at, atIso: sentAt, pending: true }],
        summaryText: text,
        createdAt: sentAt,
        replyStatus: "replied",
      }),
    );
    pushStaffLine(guest, text, id);
    setEditingTime(false);
    setSchedule(emptyViewingSchedule());
  }

  function submitGuestSchedule(guest: StaffGuest) {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) return;
    const guestLineId = lineId.current++;
    const botLineId = lineId.current++;
    patchGuest(guest.id, (current) =>
      attachPipelineAndReply({
        ...current,
        status: "pending_confirm",
        requestedWhen: when,
        proposedWhen: "",
        lines: [
          ...current.lines,
          { id: guestLineId, from: "guest", text: when },
          {
            id: botLineId,
            from: "bot",
            text: `${current.lineName}，已記下想看的物件和希望時間，時間尚未確認。同事會再跟業務或屋主對過，確認後在 LINE 回你。`,
          },
        ],
      }),
    );
    setSchedule(emptyViewingSchedule());
  }

  function sendDraft(event?: FormEvent) {
    event?.preventDefault();
    if (!selected?.lineUserId) return;
    const guestId = selected.id;
    const text = (drafts[guestId] ?? "").trim();
    if (!text) return;
    const id = lineId.current++;
    const sentAt = new Date().toISOString();
    const at = formatLineClock(sentAt);
    ignoreDraftChangeRef.current = guestId;
    showOutgoing(guestId, {
      id,
      from: "staff",
      text,
      at,
      atIso: sentAt,
      pending: true,
    });
    setDrafts((current) => ({ ...current, [guestId]: "" }));
    window.requestAnimationFrame(() => resizeDraftInput());
    window.setTimeout(() => {
      if (ignoreDraftChangeRef.current === guestId) {
        ignoreDraftChangeRef.current = null;
      }
    }, 400);
    pushStaffLine(selected, text, id);
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    // Enter 直接送出；Shift+Enter 換行（不會先跳下一排）
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  }

  const activeStickerPack =
    LINE_CS_STICKER_PACKS.find((pack) => pack.packageId === stickerPackId) ||
    LINE_CS_STICKER_PACKS[0];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#c9ced6] bg-[#edf0f5] shadow-sm max-lg:fixed max-lg:inset-0 max-lg:z-[70] max-lg:h-[100dvh] max-lg:rounded-none max-lg:border-0 max-lg:bg-white max-lg:pt-[env(safe-area-inset-top)] max-lg:shadow-none">
      <div
        className={`flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#d8dde6] bg-white px-2 py-2 ${
          mobilePane === "chat" ? "max-lg:hidden" : ""
        }`}
      >
        <button
          type="button"
          aria-label="開啟選單"
          onClick={() => window.dispatchEvent(new Event("house-platform:open-admin-menu"))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 lg:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {FILTERS.map((item) => {
          const count = guests.filter((guest) => matchesFilter(guest, item.id)).length;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilter(item.id);
                setEditingTime(false);
                setDetailsOpen(false);
                setStickerOpen(false);
                setAttachOpen(false);
                setPresetOpen(false);
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-[#06c755] text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {item.label}
              <span className={`ml-1 tabular-nums ${active ? "text-white/80" : "text-zinc-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
        {notifyState !== "unsupported" ? (
          <button
            type="button"
            onClick={() => void enableDesktopNotify()}
            className={`ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              notifyState === "granted"
                ? "bg-emerald-50 text-emerald-800"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
            title="開啟後，即使關掉客服分頁也能收到客人新訊推播"
          >
            {notifyState === "granted" ? "背景通知已開啟" : "開啟背景新訊提醒"}
          </button>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden lg:grid-cols-[minmax(16rem,20%)_minmax(0,1fr)_minmax(18rem,22%)]">
        <ul
          className={`min-h-0 overflow-y-auto border-b border-[#d8dde6] bg-white max-lg:border-0 max-lg:pb-[env(safe-area-inset-bottom)] lg:border-r lg:border-b-0 ${
            mobilePane === "chat" ? "max-lg:hidden" : ""
          }`}
        >
          {!liveReady ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">載入對話中…</li>
          ) : visible.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">這個篩選目前沒有客人</li>
          ) : (
            visible.map((guest) => {
              const active = guest.id === selected?.id;
              const lastLine = guest.lines[guest.lines.length - 1];
              const preview =
                lastLine?.text.split("\n").find((row) => row.trim()) ||
                "";
              const clock = formatLineListStamp(lastLine?.atIso || guest.createdAt || "");
              return (
                <li key={guest.id} className="border-b border-zinc-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => selectGuest(guest.id)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${
                      active ? "bg-[#e7f8ee]" : "hover:bg-zinc-50"
                    }`}
                  >
                    <LineSideAvatar name={guest.lineName} src={guest.pictureUrl} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-bold text-zinc-900">{guest.lineName}</span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] leading-none text-zinc-400">
                          {clock}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-xs text-zinc-500">{preview}</span>
                        {guest.replyStatus === "awaiting_staff" ? (
                          <span
                            className="h-3 w-3 shrink-0 rounded-full bg-sky-500"
                            title="未回覆"
                            aria-label="未回覆"
                          />
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selected ? (
          <section
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[#d8dde6] bg-[#7494c0] lg:border-b-0 lg:border-r lg:border-[#d8dde6] max-lg:fixed max-lg:inset-0 max-lg:z-[70] max-lg:h-[100dvh] max-lg:w-screen max-lg:border-0 max-lg:bg-[#f3f3f3] ${
              mobilePane === "list" ? "max-lg:hidden" : ""
            }`}
          >
            <header className="shrink-0 border-b border-black/10 bg-[#432e1f] px-3 py-2.5 text-white max-lg:border-zinc-200 max-lg:bg-white max-lg:px-1 max-lg:py-1.5 max-lg:pt-[max(0.35rem,env(safe-area-inset-top))] max-lg:text-zinc-900">
              <div className="flex items-center gap-3 max-lg:relative max-lg:min-h-11">
                <button
                  type="button"
                  onClick={() => {
                    if (detailsOpen) {
                      setDetailsOpen(false);
                      setEditingTime(false);
                      return;
                    }
                    setMobilePane("list");
                    setDetailsOpen(false);
                    setStickerOpen(false);
                    setAttachOpen(false);
                    setPresetOpen(false);
                  }}
                  className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10 max-lg:text-zinc-900 max-lg:hover:bg-zinc-100 lg:hidden"
                  aria-label={detailsOpen ? "返回對話" : "返回聊天列表"}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <LineSideAvatar
                  name={selected.lineName}
                  src={selected.pictureUrl}
                  size="sm"
                  className="max-lg:hidden"
                />
                <div className="min-w-0 flex-1 max-lg:pointer-events-none max-lg:absolute max-lg:inset-x-12 max-lg:text-center">
                  <p className="truncate text-[15px] font-semibold leading-tight max-lg:text-[17px] max-lg:text-zinc-900">
                    {selected.lineName}
                  </p>
                  <p className="truncate text-[11px] text-white/65 max-lg:hidden">
                    {[
                      selected.pipeline === "active"
                        ? "進行中"
                        : selected.pipeline === "pending"
                          ? "待確認"
                          : selected.pipeline === "confirmed"
                            ? "已確認"
                            : "",
                      selected.followedAt ? `加入 ${formatLineDayLabel(selected.followedAt)}` : "",
                      selected.unfollowedAt ? "已封鎖／刪除" : "",
                      lineBasicId || "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsOpen((open) => !open);
                    setStickerOpen(false);
                    setAttachOpen(false);
                    setPresetOpen(false);
                  }}
                  className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 lg:hidden"
                  aria-label={detailsOpen ? "回對話" : "更多"}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
              </div>
            </header>

            {detailsOpen ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-4 lg:hidden">
                <GuestDecisionPanel
                  guest={selected}
                  needsConfirm={Boolean(needsConfirm)}
                  editingTime={editingTime}
                  schedule={schedule}
                  today={today}
                  onConfirm={(orderedIds) => confirmTime(selected, orderedIds)}
                  onAskOtherTime={() => askOtherTime(selected)}
                  onStartEdit={() => {
                    setEditingTime(true);
                    setSchedule(emptyViewingSchedule());
                  }}
                  onCancelEdit={() => {
                    setEditingTime(false);
                    setSchedule(emptyViewingSchedule());
                  }}
                  onScheduleChange={setSchedule}
                  onSendNewTime={() => sendNewTime(selected)}
                />
              </div>
            ) : null}

            <div
              ref={chatScrollRef}
              className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 ${
                detailsOpen ? "max-lg:hidden" : ""
              }`}
            >
              <div className="flex w-full flex-col gap-3">
                {selected.createdAt ? (
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-black/20 px-3 py-0.5 text-[11px] font-medium text-white/95 max-lg:bg-black/10 max-lg:text-zinc-600">
                      {formatLineDayLabel(selected.createdAt)}
                    </span>
                  </div>
                ) : null}
                {selected.lines.map((line) => {
                  const fromGuest = line.from === "guest";
                  const mediaType = inferMediaType(line);
                  const mediaBubble =
                    mediaType === "sticker" ||
                    mediaType === "image" ||
                    mediaType === "video" ||
                    mediaType === "audio";
                  const sideName = fromGuest
                    ? selected.lineName
                    : line.from === "staff"
                      ? staffDisplayName
                      : "自動回覆";
                  return (
                    <div
                      key={line.id}
                      className={`flex items-start gap-2 ${fromGuest ? "justify-start" : "flex-row-reverse"}`}
                    >
                      <LineSideAvatar
                        name={sideName}
                        src={fromGuest ? selected.pictureUrl : undefined}
                        className={fromGuest ? "" : "max-lg:hidden"}
                      />
                      <div
                        className={`flex min-w-0 max-w-[min(78%,28rem)] flex-col ${
                          fromGuest ? "items-start" : "items-end"
                        }`}
                      >
                        <span className="mb-0.5 px-0.5 text-[11px] font-semibold leading-none text-white/95 max-lg:hidden">
                          {sideName}
                        </span>
                        <div
                          className={`flex items-end gap-1.5 ${fromGuest ? "" : "flex-row-reverse"}`}
                        >
                          <div
                            className={`min-w-0 break-words text-[13.5px] leading-[1.55] text-zinc-900 ${
                              mediaBubble
                                ? "bg-transparent p-0 shadow-none"
                                : `whitespace-pre-wrap px-3 py-2 shadow-sm ${
                                    fromGuest
                                      ? "rounded-[18px] rounded-tl-[4px] bg-white"
                                      : "rounded-[18px] rounded-tr-[4px] bg-[#95ec69] max-lg:bg-[#d6e7fb]"
                                  }`
                            }`}
                          >
                            <LineMessageBody line={line} />
                          </div>
                          {line.at ? (
                            <span className="mb-0.5 shrink-0 text-[10px] leading-none text-white/80 max-lg:text-zinc-400">
                              {line.at}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selected.status === "picking_time" ? (
              <div
                className={`flex max-h-[48%] min-h-[14rem] flex-col border-t border-[#ebebeb] bg-white px-3 py-3 ${
                  detailsOpen ? "max-lg:hidden" : ""
                }`}
              >
                <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
                  <ViewingSchedulePicker
                    heading="客人選希望看屋時間"
                    value={schedule}
                    onChange={setSchedule}
                    minDate={today}
                    submitLabel="送出希望時間"
                    onSubmit={() => submitGuestSchedule(selected)}
                  />
                </div>
              </div>
            ) : null}

            {stickerOpen ? (
              <div
                className={`shrink-0 border-t border-[#ebebeb] bg-white px-3 py-2 ${
                  detailsOpen ? "max-lg:hidden" : ""
                }`}
              >
                <div className="mb-2 flex gap-1 overflow-x-auto">
                  {LINE_CS_STICKER_PACKS.map((pack) => (
                    <button
                      key={pack.packageId}
                      type="button"
                      onClick={() => setStickerPackId(pack.packageId)}
                      className={`shrink-0 rounded px-2.5 py-1 text-[12px] font-medium ${
                        activeStickerPack?.packageId === pack.packageId
                          ? "bg-[#eefaf2] text-[#1a7a3c]"
                          : "text-[#666] hover:bg-[#f5f5f5]"
                      }`}
                    >
                      {pack.title}
                    </button>
                  ))}
                </div>
                <div className="grid max-h-44 grid-cols-5 gap-1 overflow-y-auto sm:grid-cols-8">
                  {(activeStickerPack?.stickers ?? []).map((sticker) => (
                    <button
                      key={`${sticker.packageId}-${sticker.stickerId}`}
                      type="button"
                      title={sticker.label}
                      onClick={() => sendSticker(selected, sticker)}
                      className="flex aspect-square items-center justify-center rounded-md p-1 hover:bg-[#f5f5f5]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={stickerPreviewUrl(sticker.stickerId)}
                        alt={sticker.label}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                setAttachOpen(false);
                setPresetOpen(false);
                sendDraft(event);
              }}
              className={`shrink-0 border-t border-[#ebebeb] bg-white max-lg:px-2 max-lg:pb-[max(0.45rem,env(safe-area-inset-bottom))] max-lg:pt-1.5 lg:px-3 lg:py-2.5 ${
                detailsOpen ? "max-lg:hidden" : ""
              }`}
            >
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  onPickMedia(selected, event.target.files);
                  event.target.value = "";
                  setAttachOpen(false);
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                  onPickMedia(selected, event.target.files);
                  event.target.value = "";
                  setAttachOpen(false);
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  onPickMedia(selected, event.target.files);
                  event.target.value = "";
                  setAttachOpen(false);
                }}
              />
              <div className="lg:hidden">
                {attachOpen ? (
                  <div className="border-b border-zinc-100 px-1 pb-3 pt-2">
                    {presetOpen ? (
                      <div className="space-y-2">
                        <p className="px-2 text-xs font-semibold text-zinc-500">預設訊息</p>
                        {[
                          { label: "稍等確認時間", text: VIEWING_SUBMIT_ACK_TEXT },
                          { label: "改問其他時間", text: VIEWING_ASK_OTHER_TIME_TEXT },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setDrafts((current) => ({ ...current, [selected.id]: item.text }));
                              setPresetOpen(false);
                              setAttachOpen(false);
                              window.requestAnimationFrame(() => resizeDraftInput());
                            }}
                            className="block w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-left text-sm leading-relaxed text-zinc-800"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        <MobileAttachButton
                          label="相機"
                          disabled={!selected.lineUserId || uploadingMedia}
                          onClick={() => cameraInputRef.current?.click()}
                          icon={<MobileCameraIcon />}
                        />
                        <MobileAttachButton
                          label="照片・影片"
                          disabled={!selected.lineUserId || uploadingMedia}
                          onClick={() => imageInputRef.current?.click()}
                          icon={<MobilePhotoIcon />}
                        />
                        <MobileAttachButton
                          label="檔案"
                          disabled={!selected.lineUserId || uploadingMedia}
                          onClick={() => fileInputRef.current?.click()}
                          icon={<MobileFileIcon />}
                        />
                        <MobileAttachButton
                          label="預設訊息"
                          onClick={() => setPresetOpen(true)}
                          icon={<MobilePresetIcon />}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="flex items-end gap-1.5">
                  <button
                    type="button"
                    aria-label={attachOpen ? "關閉附件" : "開啟附件"}
                    onClick={() => {
                      setAttachOpen((open) => !open);
                      setPresetOpen(false);
                      setStickerOpen(false);
                    }}
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-zinc-500"
                  >
                    {attachOpen ? <MobileCloseIcon /> : <MobilePlusIcon />}
                  </button>
                  <label className="flex min-h-9 min-w-0 flex-1 items-center rounded-full border border-zinc-200 bg-white px-3">
                    <span className="sr-only">輸入訊息</span>
                    <textarea
                      ref={draftInputRef}
                      rows={1}
                      value={draft}
                      placeholder="輸入訊息"
                      onChange={(event) => {
                        if (ignoreDraftChangeRef.current === selected.id) return;
                        const value = event.target.value;
                        setDrafts((current) => ({ ...current, [selected.id]: value }));
                        resizeDraftInput(event.target);
                      }}
                      onKeyDown={onDraftKeyDown}
                      className="max-h-32 min-h-[1.35rem] w-full resize-none overflow-y-auto bg-transparent py-1.5 text-[15px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label="貼圖"
                    onClick={() => {
                      setStickerOpen((open) => !open);
                      setAttachOpen(false);
                      setPresetOpen(false);
                    }}
                    className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center ${
                      stickerOpen ? "text-[#4c8dff]" : "text-zinc-500"
                    }`}
                  >
                    <ComposerSmileIcon />
                  </button>
                  <button
                    type="submit"
                    aria-label="傳送"
                    disabled={!draft.trim() || !selected.lineUserId}
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-zinc-700 disabled:text-zinc-300"
                  >
                    <MobileSendIcon />
                  </button>
                </div>
              </div>
              <div className="hidden rounded-lg border border-[#e5e5e5] bg-white lg:block">
                <label className="block px-3 pt-2.5">
                  <span className="sr-only">輸入訊息</span>
                  <textarea
                    ref={desktopDraftRef}
                    rows={1}
                    value={draft}
                    placeholder="Enter: 傳送 / Shift + Enter: 換行"
                    onChange={(event) => {
                      if (ignoreDraftChangeRef.current === selected.id) return;
                      const value = event.target.value;
                      setDrafts((current) => ({ ...current, [selected.id]: value }));
                      resizeDraftInput(event.target);
                    }}
                    onKeyDown={onDraftKeyDown}
                    className="max-h-32 min-h-[2.5rem] w-full resize-none overflow-y-auto bg-transparent text-[14px] leading-6 text-[#222] outline-none placeholder:text-[#bbb]"
                  />
                </label>
                <div className="flex items-center gap-1 px-2 pb-2 pt-1">
                  <button
                    type="button"
                    aria-label="貼圖"
                    title="貼圖"
                    onClick={() => setStickerOpen((open) => !open)}
                    className={`flex h-8 w-8 items-center justify-center rounded text-[#777] hover:bg-[#f5f5f5] ${
                      stickerOpen ? "bg-[#eefaf2] text-[#06c755]" : ""
                    }`}
                  >
                    <ComposerSmileIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="附加檔案"
                    title="附加圖片"
                    disabled={!selected.lineUserId || uploadingMedia}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#777] hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    <ComposerClipIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="傳送圖片"
                    title="傳送圖片"
                    disabled={!selected.lineUserId || uploadingMedia}
                    onClick={() => imageInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#777] hover:bg-[#f5f5f5] disabled:opacity-40"
                  >
                    <ComposerImageIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="物件與時間"
                    title="物件選擇與時間"
                    onClick={focusListingPanel}
                    className="flex h-8 w-8 items-center justify-center rounded text-[#777] hover:bg-[#f5f5f5]"
                  >
                    <ComposerListingIcon />
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.trim() || !selected.lineUserId}
                    className="ml-auto rounded bg-[#06c755] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#05b34c] disabled:opacity-40"
                  >
                    傳送
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : (
          <div
            className={`flex min-h-0 flex-col items-center justify-center gap-3 border-b border-zinc-100 bg-[#7494c0] px-4 text-sm text-white/90 lg:border-b-0 lg:border-r ${
              mobilePane === "list" ? "max-lg:hidden" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setMobilePane("list")}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white lg:hidden"
            >
              返回聊天列表
            </button>
            選左邊的客人查看 LINE 對話
          </div>
        )}

        <aside
          ref={rightPanelRef}
          className="hidden min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-white px-4 py-4 lg:block"
        >
          {selected ? (
            <GuestDecisionPanel
              guest={selected}
              needsConfirm={Boolean(needsConfirm)}
              editingTime={editingTime}
              schedule={schedule}
              today={today}
              onConfirm={(orderedIds) => confirmTime(selected, orderedIds)}
              onAskOtherTime={() => askOtherTime(selected)}
              onStartEdit={() => {
                setEditingTime(true);
                setSchedule(emptyViewingSchedule());
              }}
              onCancelEdit={() => {
                setEditingTime(false);
                setSchedule(emptyViewingSchedule());
              }}
              onScheduleChange={setSchedule}
              onSendNewTime={() => sendNewTime(selected)}
            />
          ) : (
            <p className="text-sm text-zinc-500">選客人後，這裡會顯示物件選擇與時間。</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function GuestDecisionPanel({
  guest,
  needsConfirm,
  editingTime,
  schedule,
  today,
  onConfirm,
  onAskOtherTime,
  onStartEdit,
  onCancelEdit,
  onScheduleChange,
  onSendNewTime,
}: {
  guest: StaffGuest;
  needsConfirm: boolean;
  editingTime: boolean;
  schedule: ViewingScheduleValue;
  today: string;
  onConfirm: (orderedIds: string[]) => void;
  onAskOtherTime: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onScheduleChange: (next: ViewingScheduleValue) => void;
  onSendNewTime: () => void;
}) {
  const pickedKey = guest.picked.map((item) => item.id).join("|");
  const [orderIds, setOrderIds] = useState<string[]>(() => guest.picked.map((item) => item.id));

  useEffect(() => {
    setOrderIds(guest.picked.map((item) => item.id));
  }, [guest.id, pickedKey]);

  const orderedPicked = orderIds
    .map((id) => guest.picked.find((item) => item.id === id))
    .filter((item): item is PickedListing => Boolean(item));

  function movePicked(id: string, direction: -1 | 1) {
    setOrderIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(nextIndex, 0, row);
      return next;
    });
  }

  const rescheduleForm = (
    <ViewingSchedulePicker
      value={schedule}
      onChange={onScheduleChange}
      minDate={today}
      submitLabel="送出時間"
      onSubmit={onSendNewTime}
      onCancel={onCancelEdit}
    />
  );

  const listingRows = needsConfirm ? orderedPicked : guest.picked;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold text-zinc-500">這位客人</p>
        <p className="mt-1 font-bold text-zinc-900">{guest.lineName}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {[
            guest.pipeline === "active"
              ? "進行中"
              : guest.pipeline === "pending"
                ? "待確認"
                : guest.pipeline === "confirmed"
                  ? "已確認"
                  : "",
            guest.watching ? "之後新案會問" : "",
            guest.followedAt ? `加入 ${formatLineDayLabel(guest.followedAt)}` : "",
            guest.unfollowedAt ? "已封鎖／刪除" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {guest.watchCriteriaText ? (
        <div className="rounded-xl border border-[#c5d4e8] bg-[#eef3f9] p-3">
          <p className="text-xs font-semibold text-[#0b2545]">已登記找房條件</p>
          <p className="mt-1 break-words font-medium text-zinc-900">{guest.watchCriteriaText}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {guest.profileSaved ? "已有個人資料，之後約看可只選時間" : "個人資料尚未填寫"}
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold text-zinc-500">基本資料</p>
        <dl className="mt-1 space-y-1 text-zinc-800">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">電話</dt>
            <dd className="min-w-0 break-all font-medium">{guest.phone || "未填"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">人數</dt>
            <dd className="min-w-0 font-medium">{guest.peopleCount || 1} 人</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">職業</dt>
            <dd className="min-w-0 break-words font-medium">{guest.occupation || "未填"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">預計入住</dt>
            <dd className="min-w-0 font-medium">{guest.moveInDate || "未填"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">國籍</dt>
            <dd className="min-w-0 font-medium">{guest.nationality || "未填"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500">寵物</dt>
            <dd className="min-w-0 break-words font-medium">{guest.petNote || "未填"}</dd>
          </div>
          {guest.criteriaText ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">條件</dt>
              <dd className="min-w-0 break-words font-medium">{guest.criteriaText}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* 物件選擇 ＋ 帶看順序（待確認時可調順序；標題可點進廣告） */}
      <section>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-zinc-500">
            {needsConfirm ? "待確認看屋 · 物件選擇" : "物件選擇"}
          </p>
          <span className="text-[11px] text-zinc-400">{listingRows.length} 筆</span>
        </div>
        {needsConfirm ? (
          <p className="mt-1 text-[11px] text-zinc-500">帶看順序（標題 → 網址 → 地圖）</p>
        ) : null}
        <div className="mt-2 space-y-1.5">
          {listingRows.length ? (
            listingRows.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-[#fafafa] px-2.5 py-2"
              >
                {needsConfirm ? (
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-zinc-500">
                    {index + 1}
                  </span>
                ) : null}
                <a
                  href={`/listings/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate text-[13px] font-medium text-[#1e3a8a]">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-zinc-500">{formatRent(item.price)}</span>
                </a>
                {needsConfirm ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => movePicked(item.id, -1)}
                      className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="下移"
                      disabled={index === listingRows.length - 1}
                      onClick={() => movePicked(item.id, 1)}
                      className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-400">還沒勾選物件</p>
          )}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-zinc-500">時間</p>
        <p className="mt-1 text-[14px] font-semibold text-[#0b2545]">
          {guest.requestedWhen || "還沒選"}
        </p>
        {guest.proposedWhen ? (
          <p className="mt-1 text-sm text-sky-900">改問 {guest.proposedWhen}</p>
        ) : null}
      </section>

      {needsConfirm ? (
        <section className="space-y-2">
          {!editingTime ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onConfirm(orderIds)}
                className="rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white"
              >
                可以這個時間
              </button>
              <button
                type="button"
                onClick={onAskOtherTime}
                className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
              >
                改時間
              </button>
            </div>
          ) : (
            rescheduleForm
          )}
        </section>
      ) : null}

      {guest.status === "confirmed" ? (
        <section className="space-y-2">
          {!editingTime ? (
            <button
              type="button"
              onClick={onAskOtherTime}
              className="w-full rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
            >
              改時間
            </button>
          ) : (
            rescheduleForm
          )}
        </section>
      ) : null}
    </div>
  );
}

function MobileAttachButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-1 py-2 text-zinc-500 disabled:opacity-40"
    >
      <span className="flex h-12 w-12 items-center justify-center">{icon}</span>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  );
}

function MobilePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function MobileCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function MobileSendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M4.2 11.2 19.5 4.4c.7-.3 1.4.4 1.1 1.1l-6.8 15.3c-.3.7-1.3.6-1.5-.1l-1.8-6.1-6.1-1.8c-.7-.2-.8-1.2-.2-1.6Z" />
    </svg>
  );
}

function MobileCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M8 7.5 9.2 5.8A1 1 0 0 1 10 5.4h4a1 1 0 0 1 .8.4L16 7.5h2.2A1.8 1.8 0 0 1 20 9.3v7.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 16.7V9.3A1.8 1.8 0 0 1 5.8 7.5H8Z" />
      <circle cx="12" cy="12.2" r="3.1" />
    </svg>
  );
}

function MobilePhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="9.2" r="1.3" />
      <path d="m6 16.5 3.4-3.3a1 1 0 0 1 1.4 0L14 16.2l1.2-1.1a1 1 0 0 1 1.3 0L19 17.4" strokeLinecap="round" />
    </svg>
  );
}

function MobileFileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M7 3.8h6.2L19 9.6V20.2H7V3.8Z" />
      <path d="M13 3.8V9.6h6" />
    </svg>
  );
}

function MobilePresetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M6 6.5h12v8.2H9.2L6 17.2V6.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ComposerSmileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 10.2h.01M15.5 10.2h.01" strokeLinecap="round" />
      <path d="M8.8 14c1 1.3 2.4 2 3.2 2s2.2-.7 3.2-2" strokeLinecap="round" />
    </svg>
  );
}

function ComposerClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path
        d="M15.2 7.3 9.4 13a2.4 2.4 0 1 0 3.4 3.4l6.7-6.7a3.8 3.8 0 0 0-5.4-5.4L7.3 11a5.2 5.2 0 0 0 7.4 7.4l5.2-5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComposerImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m7.5 16.2 3.2-3.2 2.3 2.3 3-3.4 3 4.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ComposerListingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2H10.2V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z" strokeLinejoin="round" />
    </svg>
  );
}
