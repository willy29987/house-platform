"use client";

import { useMemo, useState, type ReactNode } from "react";
import liff from "@line/liff";
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
      className={`rounded-full border px-3 py-1.5 text-sm ${
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

export function LineLiffRentForm({
  listings,
  liffId,
  lineUserId,
  displayName,
  onSubmitted,
}: {
  listings: RentalMatchListing[];
  liffId: string;
  lineUserId: string | null;
  displayName: string | null;
  onSubmitted?: (caseId: string) => void;
}) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const [criteria, setCriteria] = useState<RentalMatchCriteria>(emptyCriteria());
  const [petHas, setPetHas] = useState<"no" | "yes" | null>(null);
  const [petDraft, setPetDraft] = useState("");
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

  const matched = useMemo(() => {
    const result = matchRentals(listings, criteria);
    return result.items.slice(0, MATCH_LIST_LIMIT);
  }, [listings, criteria]);

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
    if (!occupation.trim()) {
      setError("請填寫職業");
      return;
    }
    if (!moveIn) {
      setError("請選擇預計入住日");
      return;
    }
    if (!petNote) {
      setError("請選擇是否養寵物");
      return;
    }
    if (!nationality) {
      setError("請填寫國籍");
      return;
    }
    const phoneTrim = phone.trim();
    if (!/^09\d{8}$/.test(phoneTrim) && !/^0\d{8,12}$/.test(phoneTrim)) {
      setError("請留下有效電話（例如 0912345678）");
      return;
    }

    const picked = matched
      .filter((item) => pickedIds.includes(item.id))
      .map((item) => ({ id: item.id, title: item.title, price: item.price }));
    const criteriaText = [
      ...criteriaSummary(criteria)
        .split(" · ")
        .filter((part) => !part.includes("衛浴")),
      `${peopleCount} 人`,
      occupation.trim(),
      `入住 ${formatDateYmd(moveIn)}`,
      petNote === "沒有" ? "沒有寵物" : `有養寵物（${petNote}）`,
      nationality,
    ].join(" · ");

    const listingLines = picked.map((item, index) => {
      const price = item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
      return `${index + 1}. ${item.title}${price}`;
    });
    const summaryText = [
      "已收到你的找房資料，整理如下：",
      "",
      `看屋時間：${when}`,
      "",
      "想看的物件：",
      ...listingLines,
      "",
      "時間需同事確認後會再回覆你。",
    ].join("\n");

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/line/rental-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          displayName: displayName || "LINE 客人",
          phone: phoneTrim,
          occupation: occupation.trim(),
          nationality,
          peopleCount,
          petNote,
          moveInDate: moveIn,
          criteriaText,
          picked,
          requestedWhen: when,
          summaryText,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        pushSent?: boolean;
        confirmText?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "送出失敗");
      }

      // 正式站若 server push 失敗，在 LINE App 內備援回傳摘要
      if (!data?.pushSent && liffId) {
        try {
          if (liff.isInClient()) {
            await liff.sendMessages([
              { type: "text", text: data.confirmText || summaryText },
            ]);
          }
        } catch {
          /* ignore */
        }
      }

      setDone({ when, titles: picked.map((item) => item.title) });
      if (data?.id) onSubmitted?.(data.id);
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
        <p className="text-sm text-zinc-600">請回到 LINE 查看確認訊息。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-zinc-900">找房需求表單</h1>
        <p className="mt-1 text-xs text-zinc-500">一次填完條件、基本資料，再選物件與看屋時間</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-28">
        <Section title="1. 找房條件">
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
                  onClick={() =>
                    setCriteria((c) => ({
                      ...c,
                      priceKeys: toggleIn(c.priceKeys, o.value),
                    }))
                  }
                />
              ))}
              <Chip
                label="不限"
                active={criteria.priceKeys.length === 0}
                onClick={() => setCriteria((c) => ({ ...c, priceKeys: [] }))}
              />
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
            <div className="flex flex-wrap gap-2">
              <Chip label="沒有" active={petHas === "no"} onClick={() => setPetHas("no")} />
              <Chip label="有" active={petHas === "yes"} onClick={() => setPetHas("yes")} />
            </div>
            {petHas === "yes" ? (
              <input
                value={petDraft}
                onChange={(e) => setPetDraft(e.target.value)}
                placeholder="什麼寵物？"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        </Section>

        <Section title="2. 基本資料">
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">幾個人住</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Chip
                  key={n}
                  label={`${n} 人`}
                  active={peopleCount === n}
                  onClick={() => setPeopleCount(n)}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium text-zinc-500">
            職業
            <input
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="例如：上班族、學生"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-500">
            預計入住日
            <input
              type="date"
              min={today}
              value={moveIn}
              onChange={(e) => setMoveIn(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">國籍</p>
            <div className="flex flex-wrap gap-2">
              <Chip
                label="本國"
                active={nationalityLocal === "local"}
                onClick={() => setNationalityLocal("local")}
              />
              <Chip
                label="其他"
                active={nationalityLocal === "other"}
                onClick={() => setNationalityLocal("other")}
              />
            </div>
            {nationalityLocal === "other" ? (
              <input
                value={nationalityDraft}
                onChange={(e) => setNationalityDraft(e.target.value)}
                placeholder="請輸入國籍"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            ) : null}
          </div>
          <label className="block text-xs font-medium text-zinc-500">
            電話
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="0912345678"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
        </Section>

        <Section title="3. 看屋時間">
          <ViewingSchedulePicker
            heading="先選日期與開始時間"
            value={schedule}
            onChange={setSchedule}
            minDate={today}
            submitLabel="時間已選（請再勾物件）"
            onSubmit={() => {
              if (!formatViewingRange(schedule.date, schedule.start)) {
                setError("請選擇日期與開始時間");
              } else {
                setError("");
              }
            }}
          />
        </Section>

        <Section title={`4. 配對物件（${matched.length}）`}>
          <p className="text-xs text-zinc-500">依上方條件即時篩選，可複選想看的房子</p>
          {matched.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
              目前沒有符合條件的物件，請放寬條件再試。
            </p>
          ) : (
            <div className="space-y-2">
              {matched.map((item) => {
                const on = pickedIds.includes(item.id);
                const photo = item.coverImage || item.images[0];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePick(item.id)}
                    className={`flex w-full gap-3 rounded-2xl border p-3 text-left ${
                      on ? "border-[#06c755] ring-1 ring-[#06c755]" : "border-zinc-200"
                    }`}
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
                      <span className="mt-1 inline-block text-xs font-semibold text-[#067a36]">
                        {on ? "已選" : "點選"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white px-3 py-3">
        <div className="mx-auto max-w-md">
          {error ? <p className="mb-2 text-center text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="w-full rounded-full bg-[#06c755] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "送出中…" : "確認送出"}
          </button>
        </div>
      </footer>
    </div>
  );
}
