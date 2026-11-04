"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";
import { formatViewingRange, RENT_PRICE_OPTIONS, type RentalMatchListing } from "@/lib/line-rental-assistant";
import type {
  LineConversation,
  LineConversationMediaType,
} from "@/lib/line-conversations";
import type { LineRentalCase } from "@/lib/line-rental-cases";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";

type GuestStatus =
  | "selecting"
  | "picking_time"
  | "pending_confirm"
  | "reschedule_sent"
  | "confirmed"
  | "saved"
  | "awaiting_staff"
  | "awaiting_agent"
  | "agent_proposing";

type ListFilter = "all" | "pending" | "active" | "confirmed";

type ChatLine = {
  id: string | number;
  from: "guest" | "bot" | "staff";
  text: string;
  at?: string;
  messageId?: string;
  mediaType?: LineConversationMediaType;
  stickerId?: string;
  packageId?: string;
};

type PickedListing = { id: string; title: string; price: number };

type FollowAsk = { listingId: string; title: string; answer: "pending" | "yes" | "no" };

type StaffGuest = {
  id: string;
  lineUserId?: string;
  caseId?: string;
  lineName: string;
  status: GuestStatus;
  watching: boolean;
  criteriaText: string;
  /** 列表預覽用 */
  summaryText: string;
  createdAt: string;
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

function stickerImageUrl(stickerId: string) {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(stickerId)}/android/sticker.png`;
}

function lineContentUrl(messageId: string) {
  return `/api/line/message-content/${encodeURIComponent(messageId)}`;
}

/** 文字＋貼圖／圖片／影片預覽，接近 LINE 對話顯示 */
function LineMessageBody({ line }: { line: ChatLine }) {
  const mediaType = inferMediaType(line);

  if (mediaType === "sticker" && line.stickerId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={stickerImageUrl(line.stickerId)}
        alt="貼圖"
        className="h-28 w-28 object-contain"
        loading="lazy"
      />
    );
  }

  if (mediaType === "image" && line.messageId && /^\d+$/.test(line.messageId)) {
    const href = lineContentUrl(line.messageId);
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

  if (mediaType === "video" && line.messageId && /^\d+$/.test(line.messageId)) {
    return (
      <video
        src={lineContentUrl(line.messageId)}
        controls
        playsInline
        className="max-h-64 max-w-full rounded-lg bg-black"
      />
    );
  }

  if (mediaType === "audio" && line.messageId && /^\d+$/.test(line.messageId)) {
    return <audio src={lineContentUrl(line.messageId)} controls className="w-full max-w-[16rem]" />;
  }

  if (mediaType === "sticker") {
    return <span className="text-zinc-600">［貼圖］</span>;
  }

  const parts = line.text.split(/(https?:\/\/[^\s]+)/g);
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
  awaiting_staff: "待回覆",
  awaiting_agent: "待業務確認",
  agent_proposing: "業務改約中",
};

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "pending", label: "待確認" },
  { id: "active", label: "進行中" },
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

function buildStaffGuests(listings: RentalMatchListing[]): StaffGuest[] {
  const first = listings[0];
  const second = listings[1] ?? listings[0];
  const third = listings[2] ?? listings[0];
  const firstPick = pickedOf(first);
  const secondPick = pickedOf(second);

  return [
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
        staff: "2026/10/30 上午 9:00–12:00 可以，同事會再跟你說帶看的人。",
      }),
    },
  ];
}

function shortStatus(status: GuestStatus) {
  return STATUS_LABEL[status];
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

  return {
    id: item.lineUserId || item.id,
    lineUserId: item.lineUserId || undefined,
    caseId: item.id,
    lineName: item.displayName || "LINE 客人",
    status,
    watching: true,
    criteriaText: criteriaBits.join(" · ") || item.criteriaText,
    summaryText: lineMessage,
    createdAt,
    picked: item.picked,
    requestedWhen: item.requestedWhen,
    proposedWhen: item.proposedWhen || "",
    asks: [],
    lines,
  };
}

function buildLiveGuests(
  conversations: LineConversation[],
  cases: LineRentalCase[],
): StaffGuest[] {
  const fromConversations = conversations.map((item) =>
    conversationToStaffGuest(item, cases),
  );
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
): StaffGuest {
  const related = cases.filter((item) => item.lineUserId === conversation.lineUserId);
  const latest = related[0] ?? null;
  const base = latest ? caseToStaffGuest(latest) : null;

  const lines: ChatLine[] = conversation.messages.map((message) => ({
    id: message.id,
    from: message.from === "guest" ? "guest" : message.from === "staff" ? "staff" : "bot",
    text: message.text,
    at: formatLineClock(message.createdAt),
    messageId: message.messageId,
    mediaType: message.mediaType,
    stickerId: message.stickerId,
    packageId: message.packageId,
  }));

  const lastGuestText =
    [...conversation.messages].reverse().find((m) => m.from === "guest")?.text ||
    base?.summaryText ||
    "";

  return {
    id: conversation.lineUserId,
    lineUserId: conversation.lineUserId,
    caseId: latest?.id,
    lineName: conversation.displayName || base?.lineName || "LINE 客人",
    status: base?.status ?? "awaiting_staff",
    watching: true,
    criteriaText: base?.criteriaText || "",
    summaryText: lastGuestText,
    createdAt: conversation.updatedAt || base?.createdAt || new Date().toISOString(),
    picked: base?.picked ?? [],
    requestedWhen: base?.requestedWhen ?? "",
    proposedWhen: base?.proposedWhen ?? "",
    asks: [],
    lines:
      lines.length > 0
        ? lines
        : base?.lines ?? [
            {
              id: 1,
              from: "guest",
              text: lastGuestText || "（尚無訊息）",
              at: formatLineClock(conversation.updatedAt),
            },
          ],
  };
}

function matchesFilter(guest: StaffGuest, filter: ListFilter) {
  if (filter === "all") return true;
  if (filter === "pending") {
    return (
      guest.status === "pending_confirm" ||
      guest.status === "reschedule_sent" ||
      guest.status === "awaiting_staff" ||
      guest.status === "awaiting_agent" ||
      guest.status === "agent_proposing"
    );
  }
  if (filter === "confirmed") return guest.status === "confirmed";
  return guest.status === "selecting" || guest.status === "picking_time" || guest.status === "saved";
}

function statusPill(status: GuestStatus) {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-950";
  if (
    status === "pending_confirm" ||
    status === "reschedule_sent" ||
    status === "awaiting_staff" ||
    status === "awaiting_agent" ||
    status === "agent_proposing"
  ) {
    return "bg-amber-100 text-amber-950";
  }
  return "bg-zinc-100 text-zinc-700";
}

export function LineRentalPreview({
  listings,
  lineBasicId,
  initialConversations = [],
  initialCases = [],
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
  initialConversations?: LineConversation[];
  initialCases?: LineRentalCase[];
}) {
  const demoGuests = useMemo(() => buildStaffGuests(listings), [listings]);
  const seedLive = useMemo(
    () => buildLiveGuests(initialConversations, initialCases),
    [initialConversations, initialCases],
  );
  const [liveGuests, setLiveGuests] = useState<StaffGuest[]>(() => seedLive);
  const [guests, setGuests] = useState<StaffGuest[]>(() =>
    seedLive.length ? seedLive : buildStaffGuests(listings),
  );
  const [filter, setFilter] = useState<ListFilter>("pending");
  const [selectedId, setSelectedId] = useState(() => seedLive[0]?.id ?? "wang");
  const [editingTime, setEditingTime] = useState(false);
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notifyState, setNotifyState] = useState<"default" | "granted" | "denied" | "unsupported">(
    "default",
  );
  const lineId = useRef(500);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastThreadKeyRef = useRef("");
  const knownGuestMsgKeysRef = useRef<Set<string> | null>(null);
  const pageTitleRef = useRef("");
  const today = useMemo(() => taipeiTodayYmd(), []);

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
    }) {
      if (cancelled) return;
      const next = buildLiveGuests(data.conversations ?? [], data.cases ?? []);
      notifyNewGuestMessages(next);
      setLiveGuests(next);
    }

    async function loadLiveOnce() {
      try {
        const response = await fetch(`/api/line/conversations?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          conversations?: LineConversation[];
          cases?: LineRentalCase[];
        };
        applySnapshot(data);
      } catch {
        /* ignore */
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

  async function enableDesktopNotify() {
    if (typeof Notification === "undefined") {
      setNotifyState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifyState(permission);
  }

  useEffect(() => {
    // 一律以伺服器對話為準（與 LINE 同步）；勿用本地舊 lines 蓋掉 webhook 新訊息
    if (liveGuests.length) {
      setGuests(liveGuests);
      return;
    }
    setGuests(demoGuests);
  }, [liveGuests, demoGuests]);

  useEffect(() => {
    if (!liveGuests.length) return;
    setSelectedId((current) => {
      if (liveGuests.some((g) => g.id === current)) return current;
      return liveGuests[0].id;
    });
  }, [liveGuests]);

  const visible = guests.filter((guest) => matchesFilter(guest, filter));
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
  const needsConfirm =
    (selected?.status === "pending_confirm" || selected?.status === "reschedule_sent") &&
    Boolean(selected.requestedWhen || selected.proposedWhen);

  function selectGuest(id: string) {
    setSelectedId(id);
    setEditingTime(false);
    setSchedule(emptyViewingSchedule());
    setDetailsOpen(false);
  }

  function patchGuest(id: string, update: (guest: StaffGuest) => StaffGuest) {
    setGuests((current) => current.map((guest) => (guest.id === id ? update(guest) : guest)));
  }

  function pushStaffLine(guest: StaffGuest, text: string, lineIdLocal: number) {
    if (!guest.lineUserId) return;
    void fetch("/api/line/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: guest.lineUserId, text }),
    }).then(async (response) => {
      if (response.ok) return;
      patchGuest(guest.id, (current) => ({
        ...current,
        lines: current.lines.filter((line) => line.id !== lineIdLocal),
      }));
    });
  }

  function confirmTime(guest: StaffGuest) {
    const when = guest.proposedWhen || guest.requestedWhen;
    const text = `${when} 可以，同事會再跟你說帶看的人。`;
    const id = lineId.current++;
    const at = formatLineClock(new Date().toISOString());
    patchGuest(guest.id, (current) => ({
      ...current,
      status: "confirmed",
      requestedWhen: when,
      proposedWhen: "",
      lines: [...current.lines, { id, from: "staff", text, at }],
    }));
    pushStaffLine(guest, text, id);
    setEditingTime(false);
  }

  function sendNewTime(guest: StaffGuest) {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) return;
    const id = lineId.current++;
    const at = formatLineClock(new Date().toISOString());
    const text = `原本的時間暫無法安排，改 ${when} 可以嗎？`;
    patchGuest(guest.id, (current) => ({
      ...current,
      status: "reschedule_sent",
      proposedWhen: when,
      lines: [...current.lines, { id, from: "staff", text, at }],
    }));
    pushStaffLine(guest, text, id);
    setEditingTime(false);
    setSchedule(emptyViewingSchedule());
  }

  function submitGuestSchedule(guest: StaffGuest) {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) return;
    const guestLineId = lineId.current++;
    const botLineId = lineId.current++;
    patchGuest(guest.id, (current) => ({
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
    }));
    setSchedule(emptyViewingSchedule());
  }

  function sendDraft(event?: FormEvent) {
    event?.preventDefault();
    if (!selected?.lineUserId) return;
    const text = (drafts[selected.id] ?? "").trim();
    if (!text) return;
    const id = lineId.current++;
    const guestId = selected.id;
    const lineUserId = selected.lineUserId;
    const at = formatLineClock(new Date().toISOString());
    // 樂觀更新；輪詢會再以伺服器紀錄對齊
    patchGuest(guestId, (current) => ({
      ...current,
      lines: [...current.lines, { id, from: "staff", text, at }],
    }));
    setDrafts((current) => ({ ...current, [guestId]: "" }));
    pushStaffLine({ ...selected, lineUserId }, text, id);
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  }

  return (
    <div className="flex h-[min(52rem,calc(100dvh-8rem))] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-[#c9ced6] bg-[#edf0f5] shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b border-[#d8dde6] bg-white px-2 py-2">
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
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-[#06c755] text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {item.label}
              <span className={`ml-1 tabular-nums ${active ? "text-white/80" : "text-zinc-500"}`}>{count}</span>
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
            title="客人新訊息時用瀏覽器通知提醒（需保持客服頁開啟）"
          >
            {notifyState === "granted" ? "通知已開啟" : "開啟新訊提醒"}
          </button>
        ) : null}
      </div>

      {/* 左：名單｜中：LINE 對話｜右：約看處理 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 max-lg:auto-rows-auto lg:grid-cols-[17rem_minmax(0,1fr)_17rem]">
        <ul className="max-h-40 overflow-y-auto border-b border-[#d8dde6] bg-white max-lg:max-h-40 lg:max-h-none lg:border-r lg:border-b-0">
          {visible.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">這個篩選目前沒有客人</li>
          ) : (
            visible.map((guest) => {
              const active = guest.id === selected?.id;
              const preview =
                guest.summaryText.split("\n").find((row) => row.trim()) ||
                guest.lines[guest.lines.length - 1]?.text ||
                "";
              return (
                <li key={guest.id} className="border-b border-zinc-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => selectGuest(guest.id)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${active ? "bg-[#e7f8ee]" : "hover:bg-zinc-50"}`}
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-sm font-bold text-white">
                      {guest.lineName.slice(0, 1)}
                      {guest.watching ? (
                        <span
                          title="之後新案會問"
                          className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-zinc-900">{guest.lineName}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusPill(guest.status)}`}>
                          {shortStatus(guest.status)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">{preview}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selected ? (
          <section className="flex min-h-0 flex-col overflow-hidden border-b border-[#d8dde6] bg-[#7494c0] lg:border-b-0 lg:border-r lg:border-[#d8dde6]">
            <header className="shrink-0 border-b border-black/10 bg-[#432e1f] px-3 py-2.5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-sm font-bold text-white">
                  {selected.lineName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-tight">{selected.lineName}</p>
                  <p className="truncate text-[11px] text-white/65">
                    {shortStatus(selected.status)}
                    {lineBasicId ? ` · ${lineBasicId}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/15 lg:hidden"
                >
                  {detailsOpen ? "收起" : "處理"}
                </button>
              </div>
              {detailsOpen ? (
                <div className="mt-3 rounded-lg bg-white p-3 text-zinc-900 lg:hidden">
                  <GuestDecisionPanel
                    guest={selected}
                    needsConfirm={Boolean(needsConfirm)}
                    editingTime={editingTime}
                    schedule={schedule}
                    today={today}
                    onConfirm={() => confirmTime(selected)}
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
            </header>

            <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
                {selected.createdAt ? (
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-black/20 px-3 py-0.5 text-[11px] font-medium text-white/95">
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
                  return (
                    <div
                      key={line.id}
                      className={`flex items-end gap-1.5 ${fromGuest ? "justify-start" : "justify-end"}`}
                    >
                      {fromGuest ? (
                        <span className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-xs font-bold text-white">
                          {selected.lineName.slice(0, 1)}
                        </span>
                      ) : null}
                      {!fromGuest && line.at ? (
                        <span className="mb-0.5 shrink-0 text-[10px] leading-none text-white/80">{line.at}</span>
                      ) : null}
                      <div
                        className={`max-w-[min(78%,22rem)] break-words text-[13.5px] leading-[1.55] text-zinc-900 ${
                          mediaBubble
                            ? "bg-transparent p-0 shadow-none"
                            : `whitespace-pre-wrap px-3 py-2 shadow-sm ${
                                fromGuest
                                  ? "rounded-[18px] rounded-bl-[4px] bg-white"
                                  : "rounded-[18px] rounded-br-[4px] bg-[#95ec69]"
                              }`
                        }`}
                      >
                        {line.from === "staff" && !mediaBubble ? (
                          <span className="mb-1 block text-[10px] font-semibold text-[#067a36]">官方帳號／同事</span>
                        ) : null}
                        <LineMessageBody line={line} />
                      </div>
                      {fromGuest && line.at ? (
                        <span className="mb-0.5 shrink-0 text-[10px] leading-none text-white/80">{line.at}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {selected.status === "picking_time" ? (
              <div className="flex max-h-[48%] min-h-[14rem] flex-col border-t border-zinc-200 bg-white px-3 py-3">
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

            <form onSubmit={sendDraft} className="shrink-0 border-t border-black/10 bg-[#f5f5f5] px-3 py-2">
              <div className="mx-auto flex w-full max-w-xl items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">輸入訊息</span>
                  <textarea
                    rows={1}
                    value={draft}
                    placeholder="輸入訊息"
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({ ...current, [selected.id]: value }));
                    }}
                    onKeyDown={onDraftKeyDown}
                    className="max-h-28 min-h-10 w-full resize-none rounded-md border border-[#d0d3d9] bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#06c755]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!draft.trim() || !selected.lineUserId}
                  aria-label="傳送"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-white disabled:opacity-40"
                >
                  <SendIcon />
                </button>
              </div>
              <p className="mx-auto mt-1 max-w-xl text-center text-[10px] text-zinc-500">
                請用這裡回覆才會兩邊同步。用手機／電腦「官方帳號」聊天室回的訊息，LINE
                不會通知我們，網頁看不到。
              </p>
            </form>
          </section>
        ) : (
          <div className="flex items-center justify-center border-b border-zinc-100 bg-[#7494c0] px-4 text-sm text-white/90 lg:border-b-0 lg:border-r">
            選左邊的客人查看 LINE 對話
          </div>
        )}

        <aside className="hidden min-h-0 overflow-y-auto bg-white px-4 py-4 lg:block">
          {selected ? (
            <GuestDecisionPanel
              guest={selected}
              needsConfirm={Boolean(needsConfirm)}
              editingTime={editingTime}
              schedule={schedule}
              today={today}
              onConfirm={() => confirmTime(selected)}
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
            <p className="text-sm text-zinc-500">選客人後，這裡會顯示條件與看屋時間。</p>
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
  onConfirm: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onScheduleChange: (next: ViewingScheduleValue) => void;
  onSendNewTime: () => void;
}) {
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

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold text-zinc-500">這位客人</p>
        <p className="mt-1 font-bold text-zinc-900">{guest.lineName}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {shortStatus(guest.status)}
          {guest.watching ? " · 之後新案會問" : ""}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500">已勾物件（快捷連結）</p>
        <div className="mt-1 space-y-1 text-zinc-800">
          {guest.picked.length
            ? guest.picked.map((item) => (
                <a
                  key={item.id}
                  href={`/listings/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[#1e3a8a] hover:underline"
                >
                  {item.title}
                  <span className="text-zinc-500"> · {formatRent(item.price)}</span>
                </a>
              ))
            : "還沒勾"}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500">希望時間</p>
        <p className="mt-1 font-medium text-[#0b2545]">{guest.requestedWhen || "還沒選"}</p>
        {guest.proposedWhen ? <p className="mt-1 text-sky-900">改問 {guest.proposedWhen}</p> : null}
      </div>

      {needsConfirm ? (
        <div className="space-y-2 rounded-xl border border-[#c5d4e8] bg-[#eef3f9] p-3">
          <p className="text-xs font-semibold text-[#0b2545]">待確認看屋</p>
          {!editingTime ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white"
              >
                可以這個時間
              </button>
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
              >
                改時間
              </button>
            </div>
          ) : (
            rescheduleForm
          )}
        </div>
      ) : null}

      {guest.status === "confirmed" ? (
        <div className="space-y-2">
          {!editingTime ? (
            <button
              type="button"
              onClick={onStartEdit}
              className="w-full rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
            >
              改時間
            </button>
          ) : (
            rescheduleForm
          )}
        </div>
      ) : null}
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M3.4 11.2 20.2 4.2c.7-.3 1.4.4 1.1 1.1l-7 16.8c-.3.8-1.4.8-1.7 0l-2.4-6.2-6.2-2.4c-.8-.3-.8-1.4 0-1.7z" />
    </svg>
  );
}
