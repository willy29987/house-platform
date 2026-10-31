"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";
import {
  EXTRA_OPTIONS,
  MATCH_LIST_LIMIT,
  RENT_PRICE_OPTIONS,
  criteriaSummary,
  emptyCriteria,
  formatDateYmd,
  formatViewingRange,
  matchRentals,
  type RentalExtra,
  type RentalMatchCriteria,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

type ChatLine = { id: number; from: "bot" | "guest"; text: string };

type Step =
  | "welcome"
  | "city"
  | "district"
  | "rooms"
  | "parking"
  | "price"
  | "people"
  | "occupation"
  | "moveIn"
  | "pet"
  | "extras"
  | "nationality"
  | "phone"
  | "picks"
  | "time"
  | "done";

const ROOM_OPTS = [
  { id: "1", label: "1 房" },
  { id: "2", label: "2 房" },
  { id: "3", label: "3 房" },
  { id: "4", label: "4 房以上" },
];
const PARK_OPTS = [
  { id: "yes", label: "要車位" },
  { id: "no", label: "不要車位" },
  { id: "any", label: "不限" },
];
const PEOPLE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const WHEEL_ITEM_H = 40;

const WELCOME =
  "您好～請問最近有在找房子嗎？如果有需要找房子可以點選「 開始找房 」，點選您要的需求就可以推薦您合適的房源哦！";

const FIRST_QUESTION = "想住哪個城市呢？";

function toggleIn(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function formatRent(price: number) {
  return `${price.toLocaleString("zh-TW")} 元/月`;
}

function parkingLabel(parking: string[]) {
  if (!parking.length || parking.includes("any")) return "車位不限";
  return parking.map((id) => PARK_OPTS.find((o) => o.id === id)?.label ?? id).join("、");
}

function listingPhotos(item: RentalMatchListing) {
  const photos = item.images.length ? item.images : item.coverImage ? [item.coverImage] : [];
  return photos;
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
        on ? "border-[#06c755] bg-emerald-50 text-zinc-900" : "border-zinc-300 bg-white text-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function ActionRow({
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
}: {
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}) {
  if (!onContinue || !continueLabel) {
    return (
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
      >
        上一步
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onBack}
        className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
      >
        上一步
      </button>
      <button
        type="button"
        disabled={continueDisabled}
        onClick={onContinue}
        className="min-w-0 flex-1 rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {continueLabel}
      </button>
    </div>
  );
}

function PeopleCountWheel({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreScroll = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    ignoreScroll.current = true;
    el.scrollTop = (value - 1) * WHEEL_ITEM_H;
    const t = window.setTimeout(() => {
      ignoreScroll.current = false;
    }, 80);
    return () => window.clearTimeout(t);
  }, [value]);

  function onScroll() {
    if (ignoreScroll.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.min(10, Math.max(1, Math.round(el.scrollTop / WHEEL_ITEM_H) + 1));
    if (next !== value) onChange(next);
  }

  return (
    <div className="relative mx-auto h-[200px] w-full max-w-[11rem] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <div
        className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border border-[#06c755]/40 bg-emerald-50/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-16 bg-gradient-to-b from-zinc-50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-zinc-50 to-transparent"
        aria-hidden
      />
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: WHEEL_ITEM_H * 2 }} />
        {PEOPLE_OPTIONS.map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex w-full snap-center items-center justify-center text-lg tabular-nums transition ${
                active ? "font-bold text-zinc-900" : "font-medium text-zinc-400"
              }`}
              style={{ height: WHEEL_ITEM_H }}
            >
              {n} 人
            </button>
          );
        })}
        <div style={{ height: WHEEL_ITEM_H * 2 }} />
      </div>
    </div>
  );
}

function TextStep({
  value,
  onChange,
  onSubmit,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  inputMode?: "text" | "tel";
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && value.trim()) onSubmit();
      }}
      inputMode={inputMode}
      className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#06c755]"
    />
  );
}

function ListingDetailSheet({
  listing,
  onClose,
}: {
  listing: RentalMatchListing;
  onClose: () => void;
}) {
  const photos = listingPhotos(listing);
  const [photoIndex, setPhotoIndex] = useState(0);
  const current = photos[photoIndex] ?? null;
  const floorLabel =
    listing.floor != null
      ? listing.totalFloors != null
        ? `${listing.floor}/${listing.totalFloors} 樓`
        : `${listing.floor} 樓`
      : "樓層未提供";

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/40 p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
          <p className="truncate text-sm font-bold text-zinc-900">{listing.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700"
          >
            關閉
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-[4/3] bg-zinc-100">
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">尚無照片</div>
            )}
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="上一張"
                  onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="下一張"
                  onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2 py-1 text-white"
                >
                  ›
                </button>
                <p className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
                  {photoIndex + 1}/{photos.length}
                </p>
              </>
            ) : null}
          </div>
          <div className="space-y-2 px-3 py-3 text-sm text-zinc-800">
            <p className="text-base font-semibold text-zinc-900">{formatRent(listing.price)}</p>
            <p>
              {listing.city}
              {listing.district} · {listing.address}
            </p>
            <p>
              {listing.rooms} 房 · {listing.bathrooms} 衛 · {listing.areaPing} 坪 · {floorLabel}
            </p>
            <p>
              {listing.areaParkingSpace && listing.areaParkingSpace > 0 ? "有車位" : "無車位"}
              {" · "}
              {listing.petsAllowed === true ? "可養寵物" : listing.petsAllowed === false ? "不可養寵物" : "寵物未標示"}
            </p>
            <p className="text-xs text-zinc-500">
              {[
                listing.rentSubsidy ? "租屋補助" : null,
                listing.taxDeductible ? "可報稅" : null,
                listing.canRegisterAddress ? "可簽戶籍" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "補助／報稅／戶籍未標示"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export type GuestChatMode = "preview" | "liff" | "liff-demo";

function isLiffEntry(mode: GuestChatMode) {
  return mode === "liff" || mode === "liff-demo";
}

export type GuestChatSubmitPayload = {
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  criteriaText: string;
  picked: { id: string; title: string; price: number }[];
  requestedWhen: string;
  summaryText: string;
};

export function LineGuestChatPreview({
  listings,
  lineBasicId,
  mode = "preview",
  lineUserId = null,
  displayName = null,
  onSubmitted,
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
  mode?: GuestChatMode;
  lineUserId?: string | null;
  displayName?: string | null;
  onSubmitted?: (caseId: string) => void;
}) {
  const skipWelcome = isLiffEntry(mode);
  const lineId = useRef(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => taipeiTodayYmd(), []);
  const [lines, setLines] = useState<ChatLine[]>(() => [
    { id: 0, from: "bot", text: skipWelcome ? FIRST_QUESTION : WELCOME },
  ]);
  const [step, setStep] = useState<Step>(() => (skipWelcome ? "city" : "welcome"));
  const [criteria, setCriteria] = useState<RentalMatchCriteria>(emptyCriteria);
  const [peopleCount, setPeopleCount] = useState(1);
  const [occupation, setOccupation] = useState("");
  const [occupationDraft, setOccupationDraft] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [moveInSchedule, setMoveInSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule());
  const [petNote, setPetNote] = useState("");
  const [petChoice, setPetChoice] = useState<"yes" | "no" | null>(null);
  const [petDraft, setPetDraft] = useState("");
  const [nationality, setNationality] = useState("");
  const [nationalityChoice, setNationalityChoice] = useState<"local" | "other" | null>(null);
  const [nationalityDraft, setNationalityDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [matched, setMatched] = useState<RentalMatchListing[]>([]);
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const cities = useMemo(
    () => [...new Set(listings.map((item) => item.city).filter(Boolean))].sort(),
    [listings],
  );
  const districts = useMemo(() => {
    const pool = criteria.cities.length
      ? listings.filter((item) => criteria.cities.includes(item.city))
      : listings;
    return [...new Set(pool.map((item) => item.district).filter(Boolean))].sort();
  }, [listings, criteria.cities]);

  const shownListings = matched.slice(0, MATCH_LIST_LIMIT);
  const detailListing = detailId ? matched.find((item) => item.id === detailId) ?? null : null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, step]);

  function push(from: ChatLine["from"], text: string) {
    const id = lineId.current++;
    setLines((current) => [...current, { id, from, text }]);
  }

  function pushMany(items: { from: ChatLine["from"]; text: string }[]) {
    setLines((current) => {
      let nextId = lineId.current;
      const added = items.map((item) => ({ id: nextId++, ...item }));
      lineId.current = nextId;
      return [...current, ...added];
    });
  }

  function popLast(count: number) {
    setLines((current) => current.slice(0, Math.max(1, current.length - count)));
  }

  function resetAll() {
    lineId.current = 1;
    setLines([{ id: 0, from: "bot", text: skipWelcome ? FIRST_QUESTION : WELCOME }]);
    setStep(skipWelcome ? "city" : "welcome");
    setCriteria(emptyCriteria());
    setPeopleCount(1);
    setOccupation("");
    setOccupationDraft("");
    setMoveInDate("");
    setMoveInSchedule(emptyViewingSchedule());
    setPetNote("");
    setPetChoice(null);
    setPetDraft("");
    setNationality("");
    setNationalityChoice(null);
    setNationalityDraft("");
    setPhone("");
    setPhoneDraft("");
    setPickedIds([]);
    setMatched([]);
    setSchedule(emptyViewingSchedule());
    setDetailId(null);
  }

  function startFind() {
    push("guest", "開始找房");
    push("bot", FIRST_QUESTION);
    setStep("city");
  }

  function continueCity() {
    const label = criteria.cities.length ? criteria.cities.join("、") : "縣市不限";
    push("guest", label);
    push("bot", "哪個行政區呢？");
    setStep("district");
  }

  function continueDistrict() {
    const label = criteria.districts.length ? criteria.districts.join("、") : "行政區不限";
    push("guest", label);
    push("bot", "需要幾個房間呢？");
    setStep("rooms");
  }

  function continueRooms() {
    const label =
      criteria.rooms.length === 0
        ? "房數不限"
        : criteria.rooms.map((id) => ROOM_OPTS.find((o) => o.id === id)?.label ?? id).join("、");
    push("guest", label);
    push("bot", "會需要停車嗎？");
    setStep("parking");
  }

  function pickParking(id: string) {
    setCriteria((c) => ({ ...c, parking: [id] }));
  }

  function continueParking() {
    if (!criteria.parking.length) return;
    push("guest", parkingLabel(criteria.parking));
    push("bot", "預算大約多少呢？");
    setStep("price");
  }

  function continuePrice() {
    const label =
      criteria.priceKeys.length === 0
        ? "月租不限"
        : criteria.priceKeys.map((id) => RENT_PRICE_OPTIONS.find((o) => o.value === id)?.label ?? id).join("、");
    push("guest", label);
    push("bot", "預計幾個人住呢？");
    setPeopleCount(1);
    setStep("people");
  }

  function continuePeople() {
    push("guest", `${peopleCount} 人`);
    push("bot", "分別是什麼職業呢？\n（請手動輸入）");
    setOccupationDraft(occupation);
    setStep("occupation");
  }

  function continueOccupation() {
    const text = occupationDraft.trim();
    if (!text) return;
    setOccupation(text);
    push("guest", text);
    push("bot", "預計什麼時候起租呢？");
    setMoveInSchedule(moveInDate ? { date: moveInDate, start: "" } : emptyViewingSchedule());
    setStep("moveIn");
  }

  function continueMoveIn() {
    if (!moveInSchedule.date) return;
    setMoveInDate(moveInSchedule.date);
    const label = formatDateYmd(moveInSchedule.date);
    push("guest", label);
    push("bot", "有沒有養寵物呢？");
    setPetChoice(null);
    setPetDraft("");
    setStep("pet");
  }

  function finishPet(answer: string) {
    const text = answer.trim();
    if (!text) return;
    setPetNote(text);
    push("guest", text);
    push("bot", "需要租補、報稅、入籍嗎？\n（如果都不需要直接點選下一步即可）");
    setStep("extras");
  }

  function continuePet() {
    if (petChoice === "no") {
      finishPet("沒有");
      return;
    }
    if (petChoice === "yes") {
      finishPet(petDraft);
    }
  }

  function continueExtras() {
    const label =
      criteria.extras.length === 0
        ? "都不需要"
        : criteria.extras.map((id) => EXTRA_OPTIONS.find((o) => o.id === id)?.label ?? id).join("、");
    push("guest", label);
    push("bot", "是什麼國籍呢？");
    setNationalityChoice(null);
    setNationalityDraft("");
    setStep("nationality");
  }

  function continueNationality() {
    if (nationalityChoice === "local") {
      setNationality("本國");
      push("guest", "本國");
      push("bot", "方便留一個電話號碼嗎？同事確認看屋時會用到。");
      setPhoneDraft(phone);
      setStep("phone");
      return;
    }
    if (nationalityChoice === "other") {
      const text = nationalityDraft.trim();
      if (!text) return;
      setNationality(text);
      push("guest", text);
      push("bot", "方便留一個電話號碼嗎？同事確認看屋時會用到。");
      setPhoneDraft(phone);
      setStep("phone");
    }
  }

  function continuePhone() {
    const text = phoneDraft.trim();
    if (!text) return;
    setPhone(text);
    push("guest", text);

    const matchCriteria: RentalMatchCriteria = {
      ...criteria,
      bathrooms: [],
    };
    const result = matchRentals(listings, matchCriteria);
    const limited = result.items.slice(0, MATCH_LIST_LIMIT);
    setMatched(limited);
    setPickedIds([]);
    setDetailId(null);

    const profileSummary = [
      ...criteriaSummary(matchCriteria)
        .split(" · ")
        .filter((part) => !part.includes("衛浴")),
      `${peopleCount} 人`,
      occupation,
      `入住 ${formatDateYmd(moveInDate || moveInSchedule.date)}`,
      petNote === "沒有" || !petNote ? "沒有寵物" : `有養寵物（${petNote}）`,
      nationality,
      text,
    ].join(" · ");

    if (!result.items.length) {
      pushMany([{ from: "bot", text: `依你的條件（${profileSummary}）目前找不到符合物件。可重來調整條件。` }]);
      setStep("done");
      return;
    }
    const tip = result.relaxed.length ? `（已放寬：${result.relaxed.join("、")}）` : "";
    const more =
      result.items.length > MATCH_LIST_LIMIT ? `（先顯示前 ${MATCH_LIST_LIMIT} 間）` : "";
    push(
      "bot",
      `找到 ${result.items.length} 間符合的物件${tip}${more}。點物件看詳情與照片，右邊勾選想看的；可複選。`,
    );
    setStep("picks");
  }

  function continuePicks() {
    if (!pickedIds.length) return;
    const titles = matched
      .filter((item) => pickedIds.includes(item.id))
      .map((item) => item.title)
      .join("、");
    push("guest", `我想看：${titles}`);
    push("bot", "想哪一天、哪個時段看屋？");
    setSchedule(emptyViewingSchedule());
    setDetailId(null);
    setStep("time");
  }

  async function submitTime() {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when || submitting) return;

    const picked = matched
      .filter((item) => pickedIds.includes(item.id))
      .map((item) => ({ id: item.id, title: item.title, price: item.price }));
    const matchCriteria: RentalMatchCriteria = { ...criteria, bathrooms: [] };
    const criteriaText = [
      ...criteriaSummary(matchCriteria)
        .split(" · ")
        .filter((part) => !part.includes("衛浴")),
      `${peopleCount} 人`,
      occupation,
      moveInDate ? `入住 ${formatDateYmd(moveInDate)}` : "",
      petNote === "沒有" || !petNote ? "沒有寵物" : `有養寵物（${petNote}）`,
      nationality,
    ]
      .filter(Boolean)
      .join(" · ");
    const summaryText = `已記下想看的物件和希望時間（${when}），時間尚未確認。同事會再跟業務或屋主對過，確認後在 LINE 回你。`;

    if (mode === "liff" || mode === "liff-demo") {
      setSubmitting(true);
      setSubmitError("");
      try {
        const response = await fetch("/api/line/rental-cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            displayName: displayName || "LINE 客人",
            phone,
            occupation,
            nationality,
            peopleCount,
            petNote,
            moveInDate: moveInDate || moveInSchedule.date,
            criteriaText,
            picked,
            requestedWhen: when,
            summaryText,
          } satisfies GuestChatSubmitPayload & {
            lineUserId: string | null;
            displayName: string;
          }),
        });
        const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (!response.ok) {
          throw new Error(data?.error || "送出失敗");
        }
        push("guest", when);
        push("bot", summaryText);
        setStep("done");
        if (data?.id) onSubmitted?.(data.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "送出失敗";
        setSubmitError(message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    push("guest", when);
    push("bot", summaryText);
    setStep("done");
  }

  function handleBack() {
    setDetailId(null);

    if (step === "city" && skipWelcome) {
      return;
    }

    if (step === "done") {
      const finishedViewing = Boolean(schedule.date && schedule.start && matched.length);
      popLast(2);
      if (finishedViewing) {
        setStep("time");
      } else {
        setPhoneDraft(phone);
        setMatched([]);
        setPickedIds([]);
        setStep("phone");
      }
      return;
    }

    popLast(2);
    switch (step) {
      case "city":
        setStep("welcome");
        break;
      case "district":
        setStep("city");
        break;
      case "rooms":
        setStep("district");
        break;
      case "parking":
        setStep("rooms");
        break;
      case "price":
        setStep("parking");
        break;
      case "people":
        setStep("price");
        break;
      case "occupation":
        setStep("people");
        break;
      case "moveIn":
        setOccupationDraft(occupation);
        setStep("occupation");
        break;
      case "pet":
        setMoveInSchedule(moveInDate ? { date: moveInDate, start: "" } : emptyViewingSchedule());
        setStep("moveIn");
        break;
      case "extras":
        if (petNote === "沒有") {
          setPetChoice("no");
          setPetDraft("");
        } else if (petNote) {
          setPetChoice("yes");
          setPetDraft(petNote);
        } else {
          setPetChoice(null);
          setPetDraft("");
        }
        setStep("pet");
        break;
      case "nationality":
        setStep("extras");
        break;
      case "phone":
        if (nationality === "本國") {
          setNationalityChoice("local");
          setNationalityDraft("");
        } else if (nationality) {
          setNationalityChoice("other");
          setNationalityDraft(nationality);
        } else {
          setNationalityChoice(null);
          setNationalityDraft("");
        }
        setStep("nationality");
        break;
      case "picks":
        setPhoneDraft(phone);
        setMatched([]);
        setPickedIds([]);
        setStep("phone");
        break;
      case "time":
        setStep("picks");
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative mx-auto flex h-[min(44rem,calc(100dvh-11rem))] min-h-[28rem] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-base font-bold text-zinc-900">客人對話測試</p>
          <p className="text-xs text-zinc-500">示範流程，不會送到{lineBasicId ? ` ${lineBasicId}` : "官方 LINE"}</p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          重來
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#8cabd9] px-3 py-3">
        <div className="space-y-2">
          {lines.map((line) => {
            const guest = line.from === "guest";
            return (
              <div key={line.id} className={`flex ${guest ? "justify-end" : "justify-start"}`}>
                <p
                  className={`w-fit max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed text-zinc-900 ${
                    guest ? "rounded-tr-sm bg-[#95ec69]" : "rounded-tl-sm bg-white"
                  }`}
                >
                  {line.text}
                </p>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white px-3 py-3">
        {step === "welcome" ? (
          <button
            type="button"
            onClick={startFind}
            className="w-full rounded-full bg-[#06c755] px-3 py-2.5 text-sm font-semibold text-white"
          >
            開始找房
          </button>
        ) : null}

        {step === "city" ? (
          <MultiStep
            options={cities.map((city) => ({ id: city, label: city }))}
            selected={criteria.cities}
            onToggle={(id) => setCriteria((c) => ({ ...c, cities: toggleIn(c.cities, id), districts: [] }))}
            onContinue={continueCity}
            onBack={handleBack}
            continueLabel="下一步"
            showBack={!skipWelcome}
          />
        ) : null}

        {step === "district" ? (
          <MultiStep
            options={districts.map((d) => ({ id: d, label: d }))}
            selected={criteria.districts}
            onToggle={(id) => setCriteria((c) => ({ ...c, districts: toggleIn(c.districts, id) }))}
            onContinue={continueDistrict}
            onBack={handleBack}
            continueLabel="下一步"
          />
        ) : null}

        {step === "rooms" ? (
          <MultiStep
            options={ROOM_OPTS}
            selected={criteria.rooms}
            onToggle={(id) => setCriteria((c) => ({ ...c, rooms: toggleIn(c.rooms, id) }))}
            onContinue={continueRooms}
            onBack={handleBack}
            continueLabel="下一步"
          />
        ) : null}

        {step === "parking" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PARK_OPTS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  on={criteria.parking[0] === option.id}
                  onClick={() => pickParking(option.id)}
                />
              ))}
            </div>
            <ActionRow
              onBack={handleBack}
              onContinue={continueParking}
              continueLabel="下一步"
              continueDisabled={!criteria.parking.length}
            />
          </div>
        ) : null}

        {step === "price" ? (
          <MultiStep
            options={RENT_PRICE_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
            selected={criteria.priceKeys}
            onToggle={(id) => setCriteria((c) => ({ ...c, priceKeys: toggleIn(c.priceKeys, id) }))}
            onContinue={continuePrice}
            onBack={handleBack}
            continueLabel="下一步"
          />
        ) : null}

        {step === "people" ? (
          <div className="space-y-3">
            <PeopleCountWheel value={peopleCount} onChange={setPeopleCount} />
            <ActionRow onBack={handleBack} onContinue={continuePeople} continueLabel="下一步" />
          </div>
        ) : null}

        {step === "occupation" ? (
          <div className="space-y-3">
            <TextStep value={occupationDraft} onChange={setOccupationDraft} onSubmit={continueOccupation} />
            <ActionRow
              onBack={handleBack}
              onContinue={continueOccupation}
              continueLabel="下一步"
              continueDisabled={!occupationDraft.trim()}
            />
          </div>
        ) : null}

        {step === "moveIn" ? (
          <ViewingSchedulePicker
            value={moveInSchedule}
            onChange={setMoveInSchedule}
            minDate={today}
            dateOnly
            compact
            heading="預計什麼時候起租呢？"
            submitLabel="下一步"
            onSubmit={continueMoveIn}
            onBack={handleBack}
          />
        ) : null}

        {step === "pet" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label="沒有"
                on={petChoice === "no"}
                onClick={() => {
                  setPetChoice("no");
                  setPetDraft("");
                }}
              />
              <Chip
                label="有"
                on={petChoice === "yes"}
                onClick={() => {
                  setPetChoice("yes");
                  setPetDraft("");
                }}
              />
              {petChoice === "yes" ? (
                <input
                  value={petDraft}
                  onChange={(event) => setPetDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && petDraft.trim()) continuePet();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-[#06c755]"
                />
              ) : null}
            </div>
            <ActionRow
              onBack={handleBack}
              onContinue={continuePet}
              continueLabel="下一步"
              continueDisabled={
                !petChoice || (petChoice === "yes" && !petDraft.trim())
              }
            />
          </div>
        ) : null}

        {step === "extras" ? (
          <MultiStep
            options={EXTRA_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            selected={criteria.extras}
            onToggle={(id) =>
              setCriteria((c) => ({
                ...c,
                extras: toggleIn(c.extras, id) as RentalExtra[],
              }))
            }
            onContinue={continueExtras}
            onBack={handleBack}
            continueLabel="下一步"
          />
        ) : null}

        {step === "nationality" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label="本國"
                on={nationalityChoice === "local"}
                onClick={() => {
                  setNationalityChoice("local");
                  setNationalityDraft("");
                }}
              />
              <Chip
                label="其他"
                on={nationalityChoice === "other"}
                onClick={() => {
                  setNationalityChoice("other");
                  setNationalityDraft("");
                }}
              />
              {nationalityChoice === "other" ? (
                <input
                  value={nationalityDraft}
                  onChange={(event) => setNationalityDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && nationalityDraft.trim()) continueNationality();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-[#06c755]"
                />
              ) : null}
            </div>
            <ActionRow
              onBack={handleBack}
              onContinue={continueNationality}
              continueLabel="下一步"
              continueDisabled={
                !nationalityChoice ||
                (nationalityChoice === "other" && !nationalityDraft.trim())
              }
            />
          </div>
        ) : null}

        {step === "phone" ? (
          <div className="space-y-3">
            <TextStep
              value={phoneDraft}
              onChange={setPhoneDraft}
              inputMode="tel"
              onSubmit={continuePhone}
            />
            <ActionRow
              onBack={handleBack}
              onContinue={continuePhone}
              continueLabel="下一步"
              continueDisabled={!phoneDraft.trim()}
            />
          </div>
        ) : null}

        {step === "picks" ? (
          <div className="space-y-3">
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {shownListings.map((item) => {
                const on = pickedIds.includes(item.id);
                const thumb = listingPhotos(item)[0];
                return (
                  <div
                    key={item.id}
                    className={`flex overflow-hidden rounded-xl border ${
                      on ? "border-[#06c755] bg-emerald-50" : "border-zinc-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">無圖</div>
                        )}
                      </div>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-semibold text-zinc-900">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {item.district} · {formatRent(item.price)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={on ? "取消想看" : "想看這間"}
                      onClick={() => setPickedIds((ids) => toggleIn(ids, item.id))}
                      className={`flex w-[4.25rem] shrink-0 flex-col items-center justify-center border-l text-xs font-semibold ${
                        on
                          ? "border-[#06c755]/40 bg-[#06c755] text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      {on ? "已選" : "想看"}
                    </button>
                  </div>
                );
              })}
            </div>
            <ActionRow
              onBack={handleBack}
              onContinue={continuePicks}
              continueLabel="選好看屋時間"
              continueDisabled={!pickedIds.length}
            />
          </div>
        ) : null}

        {step === "time" ? (
          <div className="space-y-2">
            <ViewingSchedulePicker
              value={schedule}
              onChange={setSchedule}
              minDate={today}
              compact
              heading="想哪一天、哪個時段看屋"
              submitLabel={submitting ? "送出中…" : "送出時間"}
              onSubmit={() => {
                void submitTime();
              }}
              onBack={handleBack}
            />
            {submitError ? <p className="text-center text-xs text-red-600">{submitError}</p> : null}
          </div>
        ) : null}

        {step === "done" ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-zinc-500">
              {mode === "liff"
                ? "已送出，可關閉此視窗回到 LINE。"
                : "示範結束。點上方「重來」可再測一輪。"}
            </p>
            {mode !== "liff" ? <ActionRow onBack={handleBack} /> : null}
          </div>
        ) : null}
      </div>

      {detailListing ? <ListingDetailSheet listing={detailListing} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}

function MultiStep({
  options,
  selected,
  onToggle,
  onContinue,
  onBack,
  continueLabel,
  showBack = true,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
  continueLabel: string;
  showBack?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
        {options.length ? (
          options.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              on={selected.includes(option.id)}
              onClick={() => onToggle(option.id)}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-500">目前沒有可選項目，直接下一步即可。</p>
        )}
      </div>
      {showBack ? (
        <ActionRow onBack={onBack} onContinue={onContinue} continueLabel={continueLabel} />
      ) : (
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white"
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}
