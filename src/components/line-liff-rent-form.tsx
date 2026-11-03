"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";
import { loadLiffClient } from "@/lib/line-liff-client";
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

type Step = "criteria" | "listings" | "profile";

const STEPS: { id: Step; label: string }[] = [
  { id: "criteria", label: "條件" },
  { id: "listings", label: "物件" },
  { id: "profile", label: "資料" },
];

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" strokeLinecap="round" />
    </svg>
  );
}

const ROOM_OPTS = [
  { id: "1", label: "1 房" },
  { id: "2", label: "2 房" },
  { id: "3", label: "3 房" },
  { id: "4", label: "4 房以上" },
];

function toggleIn(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function formatRent(price: number) {
  return `${price.toLocaleString("zh-TW")} 元/月`;
}

function listingPhotos(item: RentalMatchListing) {
  return item.images.length ? item.images : item.coverImage ? [item.coverImage] : [];
}

function listingPageUrl(baseUrl: string, id: string) {
  return `${baseUrl.replace(/\/$/, "")}/listings/${id}`;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm active:opacity-80 ${
        active
          ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
          : "border-zinc-200 bg-white text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function StepDots({ step }: { step: Step }) {
  const index = STEPS.findIndex((item) => item.id === step);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {STEPS.map((item, i) => (
        <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full ${
              i <= index ? "bg-[#06c755]" : "bg-zinc-200"
            }`}
          />
          <span
            className={`text-[10px] ${
              i === index ? "font-semibold text-zinc-900" : "text-zinc-400"
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListingDetailSheet({
  listing,
  pageUrl,
  wanted,
  onToggleWant,
  onClose,
}: {
  listing: RentalMatchListing;
  pageUrl: string;
  wanted: boolean;
  onToggleWant: () => void;
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
    <div className="fixed inset-0 z-30 flex flex-col bg-black/40 p-3">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
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
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                尚無照片
              </div>
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
              {listing.petsAllowed === true
                ? "可養寵物"
                : listing.petsAllowed === false
                  ? "不可養寵物"
                  : "寵物未標示"}
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
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold text-[#067a36] underline"
            >
              開啟物件網頁
            </a>
          </div>
        </div>
        <div className="border-t border-zinc-100 p-3">
          <button
            type="button"
            onClick={onToggleWant}
            className={`w-full rounded-full py-2.5 text-sm font-bold ${
              wanted ? "bg-[#06c755] text-white" : "border border-zinc-200 bg-white text-zinc-800"
            }`}
          >
            {wanted ? "已加入想看（再點取消）" : "想看這間"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildGuestChatMessage(input: {
  displayName: string;
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  criteriaText: string;
  when: string;
  picked: { id: string; title: string; price: number }[];
  listingBaseUrl: string;
}) {
  const listingBlock = input.picked
    .map((item, index) => {
      const price =
        item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
      const url = listingPageUrl(input.listingBaseUrl, item.id);
      return `${index + 1}. ${item.title}${price}\n${url}`;
    })
    .join("\n\n");

  return [
    "【找房預約】我想看以下物件，請協助確認時間。",
    "",
    `看屋時間：${input.when}`,
    "",
    "客戶資料：",
    `暱稱：${input.displayName}`,
    `電話：${input.phone}`,
    `人數：${input.peopleCount} 人`,
    `職業：${input.occupation}`,
    `預計入住：${input.moveInDate}`,
    `國籍：${input.nationality}`,
    `寵物：${input.petNote === "沒有" ? "沒有" : input.petNote}`,
    `條件：${input.criteriaText}`,
    "",
    "想看的物件（網頁）：",
    listingBlock,
  ].join("\n");
}

export function LineLiffRentForm({
  listings,
  liffId,
  lineUserId,
  displayName,
  listingBaseUrl,
  onSubmitted,
}: {
  listings: RentalMatchListing[];
  liffId: string;
  lineUserId: string | null;
  displayName: string | null;
  listingBaseUrl: string;
  onSubmitted?: (caseId: string) => void;
}) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const [step, setStep] = useState<Step>("criteria");
  const [criteria, setCriteria] = useState<RentalMatchCriteria>(emptyCriteria());
  const [petHas, setPetHas] = useState<"no" | "yes" | null>(null);
  const [petDraft, setPetDraft] = useState("");
  const [matched, setMatched] = useState<RentalMatchListing[]>([]);
  const [matchedRelaxed, setMatchedRelaxed] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [priceCustomOn, setPriceCustomOn] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [peopleCount, setPeopleCount] = useState(1);
  const [occupation, setOccupation] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [nationalityLocal, setNationalityLocal] = useState<"local" | "other" | null>(null);
  const [nationalityDraft, setNationalityDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ when: string; titles: string[] } | null>(null);

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

  const detailListing = detailId
    ? matched.find((item) => item.id === detailId) ?? null
    : null;

  const petNote =
    petHas === "no" ? "沒有" : petHas === "yes" ? petDraft.trim() : "";
  const nationality =
    nationalityLocal === "local"
      ? "本國"
      : nationalityLocal === "other"
        ? nationalityDraft.trim()
        : "";

  function togglePick(id: string) {
    setPickedIds((current) => toggleIn(current, id));
  }

  function budgetLabel() {
    const parts: string[] = [];
    if (criteria.priceKeys.length) {
      parts.push(
        ...criteria.priceKeys.map(
          (key) => RENT_PRICE_OPTIONS.find((o) => o.value === key)?.label ?? key,
        ),
      );
    }
    if (priceCustomOn) {
      const min = priceMin.trim();
      const max = priceMax.trim();
      if (min) parts.push(`最低 ${Number(min).toLocaleString("zh-TW")}`);
      if (max) parts.push(`最高 ${Number(max).toLocaleString("zh-TW")}`);
    }
    return parts.length ? `月租 ${parts.join("、")}` : "月租不限";
  }

  function goBack() {
    setError("");
    setDetailId(null);
    if (step === "listings") setStep("criteria");
    else if (step === "profile") setStep("listings");
  }

  function confirmCriteria() {
    if (petHas === "yes" && !petDraft.trim()) {
      setError("請填寫寵物種類");
      return;
    }
    if (!petNote) {
      setError("請選擇是否養寵物");
      return;
    }
    const minRaw = priceCustomOn ? priceMin.trim() : "";
    const maxRaw = priceCustomOn ? priceMax.trim() : "";
    const min = minRaw ? Number(minRaw) : 0;
    const max = maxRaw ? Number(maxRaw) : Number.POSITIVE_INFINITY;
    if (priceCustomOn) {
      if (!minRaw && !maxRaw) {
        setError("請填寫最低或最高預算");
        return;
      }
      if (minRaw && (!Number.isFinite(min) || min < 0)) {
        setError("請填寫有效的最低預算");
        return;
      }
      if (maxRaw && (!Number.isFinite(max) || max < 0)) {
        setError("請填寫有效的最高預算");
        return;
      }
      if (minRaw && maxRaw && min > max) {
        setError("最低預算不可高於最高預算");
        return;
      }
    }

    const result = matchRentals(listings, criteria);
    const items = result.items
      .filter((item) => {
        if (minRaw && item.price < min) return false;
        if (maxRaw && item.price > max) return false;
        return true;
      })
      .slice(0, MATCH_LIST_LIMIT);
    setMatched(items);
    setMatchedRelaxed(result.relaxed);
    setPickedIds([]);
    setDetailId(null);
    setError("");
    setStep("listings");
  }

  function confirmListings() {
    if (!pickedIds.length) {
      setError("請至少選一間想看的物件");
      return;
    }
    setError("");
    setDetailId(null);
    setStep("profile");
  }

  function confirmProfileAndSubmit() {
    if (!occupation.trim()) {
      setError("請填寫分別職業");
      return;
    }
    if (!moveIn) {
      setError("請選擇預計入住日");
      return;
    }
    if (!nationality) {
      setError("請填寫國籍");
      return;
    }
    const phoneTrim = phone.trim();
    if (!/^09\d{8}$/.test(phoneTrim) && !/^0\d{8,12}$/.test(phoneTrim)) {
      setError("請留下有效電話");
      return;
    }
    if (!formatViewingRange(schedule.date, schedule.start)) {
      setError("請選擇看屋時間");
      return;
    }
    void submit();
  }

  async function submit() {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) {
      setError("請選擇看屋時間");
      return;
    }
    if (!pickedIds.length) {
      setError("請至少選一間物件");
      return;
    }

    const picked = matched
      .filter((item) => pickedIds.includes(item.id))
      .map((item) => ({ id: item.id, title: item.title, price: item.price }));
    const phoneTrim = phone.trim();
    const name = displayName || "LINE 客人";
    const criteriaText = [
      ...criteriaSummary({ ...criteria, priceKeys: [] })
        .split(" · ")
        .filter((part) => !part.includes("衛浴") && !part.includes("月租")),
      budgetLabel(),
      petNote === "沒有" ? "沒有寵物" : `有養寵物（${petNote}）`,
    ].join(" · ");
    // priceKeys 已併入 budgetLabel，避免重複

    const chatText = buildGuestChatMessage({
      displayName: name,
      phone: phoneTrim,
      occupation: occupation.trim(),
      nationality,
      peopleCount,
      petNote,
      moveInDate: formatDateYmd(moveIn),
      criteriaText,
      when,
      picked,
      listingBaseUrl,
    });

    setSubmitting(true);
    setError("");
    try {
      // 1) 盡量用客戶端 sendMessages；2) 失敗則靠後端 force push
      let clientSent = false;
      let resolvedUserId = lineUserId;
      let liff: Awaited<ReturnType<typeof loadLiffClient>> = null;
      if (liffId) {
        try {
          liff = await loadLiffClient();
          if (liff) {
            try {
              await liff.init({ liffId });
            } catch {
              /* 可能已 init */
            }
            if (!resolvedUserId) {
              try {
                const ctx = liff.getContext();
                if (ctx?.userId) resolvedUserId = ctx.userId;
              } catch {
                /* ignore */
              }
              if (!resolvedUserId && liff.isLoggedIn()) {
                try {
                  const profile = await liff.getProfile();
                  resolvedUserId = profile.userId;
                } catch {
                  /* ignore */
                }
              }
            }
            if (liff.isInClient()) {
              await liff.sendMessages([{ type: "text", text: chatText }]);
              clientSent = true;
            }
          }
        } catch (sendError) {
          console.warn("[liff-rent-form] sendMessages failed", sendError);
        }
      }

      const response = await fetch("/api/line/rental-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: resolvedUserId,
          displayName: name,
          phone: phoneTrim,
          occupation: occupation.trim(),
          nationality,
          peopleCount,
          petNote,
          moveInDate: moveIn,
          criteriaText: [
            criteriaText,
            `${peopleCount} 人`,
            occupation.trim(),
            `入住 ${formatDateYmd(moveIn)}`,
            nationality,
          ].join(" · "),
          picked,
          requestedWhen: when,
          summaryText: chatText,
          // 只有確定客戶端已送出才略過 push，避免對話空白
          skipGuestPush: clientSent,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        pushSent?: boolean;
        confirmText?: string;
      } | null;
      if (!response.ok || !data) {
        throw new Error(data?.error || "送出失敗");
      }

      if (!clientSent && liff?.isInClient()) {
        try {
          await liff.sendMessages([
            { type: "text", text: data.confirmText || chatText },
          ]);
          clientSent = true;
        } catch {
          /* ignore */
        }
      }

      if (!clientSent && !data.pushSent) {
        throw new Error(
          "無法送到 LINE 對話。請從官方帳號的「打開找房表單」重新開啟後再送一次。",
        );
      }

      setDone({ when, titles: picked.map((item) => item.title) });
      if (liff?.isInClient()) {
        try {
          liff.closeWindow();
        } catch {
          /* ignore */
        }
      }
      if (data.id) onSubmitted?.(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 bg-zinc-100 px-4 text-center">
        <p className="text-lg font-bold text-zinc-900">已送出</p>
        <div className="w-full rounded-2xl bg-white px-4 py-3 text-left text-sm text-zinc-700">
          <p>
            看屋時間：<span className="font-semibold text-zinc-900">{done.when}</span>
          </p>
          <p className="mt-2 font-semibold text-zinc-900">想看的物件</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {done.titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-zinc-600">請回到 LINE 與不動產實踐家的對話查看訊息。</p>
      </div>
    );
  }

  const primaryLabel =
    step === "criteria"
      ? "確認條件，看物件"
      : step === "listings"
        ? "下一步：填基本資料"
        : submitting
          ? "送出中…"
          : "確認送出到對話";

  function onPrimary() {
    if (step === "criteria") confirmCriteria();
    else if (step === "listings") confirmListings();
    else confirmProfileAndSubmit();
  }

  return (
    <div className="relative z-0 mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-100">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {step !== "criteria" ? (
            <button
              type="button"
              onClick={goBack}
              className="touch-manipulation rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
            >
              返回
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-zinc-900">找房需求表單</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {step === "criteria"
                ? "先填找房條件"
                : step === "listings"
                  ? "點物件看詳情，右側點「想看」"
                  : "填基本資料與看屋時間後送出"}
            </p>
          </div>
        </div>
        <StepDots step={step} />
      </header>

      <div className="flex-1 space-y-3 px-3 py-3 pb-4">
        {step === "criteria" ? (
          <Section title="找房條件">
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">縣市（可複選）</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <Chip
                    key={city}
                    label={city}
                    active={criteria.cities.includes(city)}
                    onClick={() =>
                      setCriteria((c) => ({
                        ...c,
                        cities: toggleIn(c.cities, city),
                        districts: [],
                      }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.cities.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, cities: [], districts: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">行政區（可複選）</p>
              <div className="flex flex-wrap gap-2">
                {districts.slice(0, 16).map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={criteria.districts.includes(d)}
                    onClick={() =>
                      setCriteria((c) => ({ ...c, districts: toggleIn(c.districts, d) }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.districts.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, districts: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">房間數量</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_OPTS.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    active={criteria.rooms.includes(o.id)}
                    onClick={() =>
                      setCriteria((c) => ({ ...c, rooms: toggleIn(c.rooms, o.id) }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.rooms.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, rooms: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">月租預算</p>
              <div className="flex flex-wrap gap-2">
                {RENT_PRICE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={criteria.priceKeys.includes(o.value)}
                    onClick={() => {
                      setPriceCustomOn(false);
                      setPriceMin("");
                      setPriceMax("");
                      setCriteria((c) => ({
                        ...c,
                        priceKeys: toggleIn(c.priceKeys, o.value),
                      }));
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-nowrap items-center gap-1.5">
                <Chip
                  label="自訂"
                  active={priceCustomOn}
                  onClick={() => {
                    setCriteria((c) => ({ ...c, priceKeys: [] }));
                    setPriceCustomOn((on) => {
                      if (on) {
                        setPriceMin("");
                        setPriceMax("");
                      }
                      return !on;
                    });
                  }}
                />
                {priceCustomOn ? (
                  <>
                    <span className="shrink-0 text-xs text-zinc-500">最低</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-2 py-2 text-sm text-zinc-900"
                      aria-label="最低預算"
                    />
                    <span className="shrink-0 text-xs text-zinc-500">最高</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-2 py-2 text-sm text-zinc-900"
                      aria-label="最高預算"
                    />
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">租補／報稅／入戶籍</p>
              <div className="flex flex-wrap gap-2">
                {EXTRA_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    active={criteria.extras.includes(o.id)}
                    onClick={() =>
                      setCriteria((c) => ({
                        ...c,
                        extras: toggleIn(c.extras, o.id) as RentalExtra[],
                      }))
                    }
                  />
                ))}
                <Chip
                  label="都不需要"
                  active={criteria.extras.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, extras: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">寵物</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPetHas("no");
                    setPetDraft("");
                  }}
                  className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                    petHas === "no"
                      ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  沒有
                </button>
                <button
                  type="button"
                  onClick={() => setPetHas("yes")}
                  className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                    petHas === "yes"
                      ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  有
                </button>
                {petHas === "yes" ? (
                  <input
                    value={petDraft}
                    onChange={(e) => setPetDraft(e.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                ) : null}
              </div>
            </div>
          </Section>
        ) : null}

        {step === "listings" ? (
          <Section title={`配對物件（${matched.length}）`}>
            <p className="text-xs text-zinc-500">
              點左側看詳情；右側「想看」可複選。
              {matchedRelaxed.length ? `（已放寬：${matchedRelaxed.join("、")}）` : ""}
            </p>
            {matched.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                目前沒有符合條件的物件，請返回調整條件。
              </p>
            ) : (
              <div className="space-y-2">
                {matched.map((item) => {
                  const on = pickedIds.includes(item.id);
                  const photo = listingPhotos(item)[0];
                  return (
                    <div
                      key={item.id}
                      className={`flex overflow-hidden rounded-2xl border bg-white ${
                        on ? "border-[#06c755]" : "border-zinc-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailId(item.id)}
                        className="flex min-w-0 flex-1 gap-3 p-3 text-left"
                      >
                        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-zinc-900">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {item.city}
                            {item.district} · {item.rooms} 房 · {formatRent(item.price)}
                          </span>
                          <span className="mt-1 inline-block text-xs text-[#067a36]">
                            點此看詳細資訊
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={on ? "取消想看" : "想看這間"}
                        onClick={() => togglePick(item.id)}
                        className={`flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-l text-xs font-bold ${
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
            )}
          </Section>
        ) : null}

        {step === "profile" ? (
          <>
            <Section title="基本資料">
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">幾個人住</p>
                <div className="flex flex-nowrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <label
                      key={n}
                      className={`inline-flex min-h-11 flex-1 cursor-pointer touch-manipulation items-center justify-center rounded-full border px-1 text-sm ${
                        peopleCount === n
                          ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                          : "border-zinc-200 bg-white text-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="peopleCount"
                        className="sr-only"
                        checked={peopleCount === n}
                        onChange={() => setPeopleCount(n)}
                      />
                      {n}人
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-medium text-zinc-500">
                分別職業
                <input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">預計入住日</p>
                <label className="flex cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                  <CalendarIcon className="h-5 w-5 shrink-0 text-zinc-500" />
                  <input
                    type="date"
                    min={today}
                    value={moveIn}
                    onChange={(e) => setMoveIn(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none"
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">國籍</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNationalityLocal("local");
                      setNationalityDraft("");
                    }}
                    className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                      nationalityLocal === "local"
                        ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    本國
                  </button>
                  <button
                    type="button"
                    onClick={() => setNationalityLocal("other")}
                    className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                      nationalityLocal === "other"
                        ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    其他
                  </button>
                  {nationalityLocal === "other" ? (
                    <input
                      value={nationalityDraft}
                      onChange={(e) => setNationalityDraft(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    />
                  ) : null}
                </div>
              </div>
              <label className="block text-xs font-medium text-zinc-500">
                電話
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
            </Section>

            <Section title="看屋時間">
              <p className="text-xs text-zinc-500">
                已選 {pickedIds.length} 間想看物件，選時間後送出會傳到對話。
              </p>
              <ViewingSchedulePicker
                heading="選擇日期與開始時間"
                value={schedule}
                onChange={setSchedule}
                minDate={today}
                submitLabel="時間已選"
                onSubmit={() => {
                  if (!formatViewingRange(schedule.date, schedule.start)) {
                    setError("請選擇日期與開始時間");
                  } else {
                    setError("");
                  }
                }}
              />
            </Section>
          </>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          {error ? <p className="mb-2 text-center text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={submitting || (step === "listings" && matched.length === 0)}
            onClick={onPrimary}
            className="touch-manipulation w-full rounded-full bg-[#06c755] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>
      </footer>

      {detailListing ? (
        <ListingDetailSheet
          listing={detailListing}
          pageUrl={listingPageUrl(listingBaseUrl, detailListing.id)}
          wanted={pickedIds.includes(detailListing.id)}
          onToggleWant={() => togglePick(detailListing.id)}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
