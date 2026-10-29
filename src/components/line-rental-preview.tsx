"use client";

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";
import { formatViewingWhen, RENT_PRICE_OPTIONS, VIEWING_SLOTS, type RentalMatchListing } from "@/lib/line-rental-assistant";

type GuestStatus = "selecting" | "picking_time" | "pending_confirm" | "reschedule_sent" | "confirmed" | "saved";

type ChatLine = { id: number; from: "guest" | "bot" | "staff"; text: string };

type PickedListing = { id: string; title: string; price: number };

type FollowAsk = { listingId: string; title: string; answer: "pending" | "yes" | "no" };

type StaffGuest = {
  id: string;
  lineName: string;
  status: GuestStatus;
  watching: boolean;
  criteriaText: string;
  picked: PickedListing[];
  requestedWhen: string;
  proposedWhen: string;
  lines: ChatLine[];
  asks: FollowAsk[];
};

const STATUS_LABEL: Record<GuestStatus, string> = {
  selecting: "正在選條件",
  picking_time: "正在選看屋時間",
  pending_confirm: "待確認看屋",
  reschedule_sent: "已改期，等回覆",
  confirmed: "時間已確認",
  saved: "條件已留下",
};

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
  extra?: { name?: string; when?: string; staff?: string },
): ChatLine[] {
  const lines: ChatLine[] = [];
  const add = (from: ChatLine["from"], text: string) => {
    lines.push({ id: lines.length + 1, from, text });
  };
  const city = listing?.city || "台北市";
  add("bot", WELCOME);
  add("guest", "開始找房");
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
  add("bot", "想哪一天、哪個時段看屋？先選日期，再選一個時段。這還不是確定的預約。");
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
      criteriaText: "台北市 · 行政區還沒選",
      picked: [],
      requestedWhen: "",
      proposedWhen: "",
      asks: [],
      lines: fullThread(undefined, "district"),
    },
    {
      id: "lin",
      lineName: "林先生",
      status: "picking_time",
      watching: true,
      criteriaText: criteriaFrom(first, "新北市 · 板橋區 · 2 房 · 要車位"),
      picked: firstPick,
      requestedWhen: "",
      proposedWhen: "",
      asks: [],
      lines: fullThread(first, "time"),
    },
    {
      id: "wang",
      lineName: "王先生",
      status: "pending_confirm",
      watching: true,
      criteriaText: criteriaFrom(second, "台北市 · 中山區 · 2 房"),
      picked: secondPick,
      requestedWhen: "2026/11/03 下午 13:00–17:00",
      proposedWhen: "",
      asks: second ? [{ listingId: second.id, title: second.title, answer: "yes" }] : [],
      lines: fullThread(second, "booked", { name: "王先生", when: "2026/11/03 下午 13:00–17:00" }),
    },
    {
      id: "zhang",
      lineName: "張小姐",
      status: "saved",
      watching: true,
      criteriaText: criteriaFrom(third, "台北市 · 1 房 · 租屋補助"),
      picked: [],
      requestedWhen: "",
      proposedWhen: "",
      asks: third ? [{ listingId: third.id, title: third.title, answer: "no" }] : [],
      lines: fullThread(third, "declined"),
    },
    {
      id: "huang",
      lineName: "黃先生",
      status: "confirmed",
      watching: true,
      criteriaText: criteriaFrom(first, "新北市 · 3 房 · 要車位 · 簽戶籍"),
      picked: firstPick,
      requestedWhen: "2026/10/30 上午 9:00–12:00",
      proposedWhen: "",
      asks: [],
      lines: fullThread(first, "booked", {
        name: "黃先生",
        when: "2026/10/30 上午 9:00–12:00",
        staff: "2026/10/30 上午 9:00–12:00 可以，同事會再跟你說帶看的人。",
      }),
    },
  ];
}

function statusBadge(status: GuestStatus) {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-950";
  if (status === "reschedule_sent") return "bg-sky-100 text-sky-950";
  if (status === "pending_confirm") return "bg-amber-100 text-amber-950";
  return "bg-zinc-100 text-zinc-700";
}

export function LineRentalPreview({ listings, lineBasicId }: { listings: RentalMatchListing[]; lineBasicId: string }) {
  const [guests, setGuests] = useState<StaffGuest[]>(() => buildStaffGuests(listings));
  const [selectedId, setSelectedId] = useState("wang");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const lineId = useRef(500);
  const today = useMemo(() => taipeiTodayYmd(), []);
  const selected = guests.find((guest) => guest.id === selectedId) ?? guests[0];
  const draft = selected ? (drafts[selected.id] ?? "") : "";
  const selectingCount = guests.filter((guest) => guest.status === "selecting" || guest.status === "picking_time").length;
  const pendingCount = guests.filter(
    (guest) => guest.status === "pending_confirm" || guest.status === "reschedule_sent",
  ).length;
  const watchingCount = guests.filter((guest) => guest.watching).length;
  const booked = guests.filter((guest) => guest.requestedWhen);
  const watches = guests.filter((guest) => guest.watching);

  function patchGuest(id: string, update: (guest: StaffGuest) => StaffGuest) {
    setGuests((current) => current.map((guest) => (guest.id === id ? update(guest) : guest)));
  }

  function confirmTime(guest: StaffGuest) {
    const text = `${guest.requestedWhen} 可以，同事會再跟你說帶看的人。`;
    const id = lineId.current++;
    patchGuest(guest.id, (current) => ({
      ...current,
      status: "confirmed",
      lines: [...current.lines, { id, from: "staff", text }],
    }));
    setEditingId(null);
  }

  function sendNewTime(guest: StaffGuest) {
    const when = formatViewingWhen(editDate, editSlot);
    if (!when) return;
    const id = lineId.current++;
    patchGuest(guest.id, (current) => ({
      ...current,
      status: "reschedule_sent",
      proposedWhen: when,
      lines: [...current.lines, { id, from: "staff", text: `原本的時間暫無法安排，改 ${when} 可以嗎？` }],
    }));
    setEditingId(null);
    setEditDate("");
    setEditSlot("");
  }

  function sendDraft(event?: FormEvent) {
    event?.preventDefault();
    if (!selected) return;
    const text = (drafts[selected.id] ?? "").trim();
    if (!text) return;
    const id = lineId.current++;
    const guestId = selected.id;
    patchGuest(guestId, (current) => ({
      ...current,
      lines: [...current.lines, { id, from: "staff", text }],
    }));
    setDrafts((current) => ({ ...current, [guestId]: "" }));
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="還在選" value={selectingCount} />
        <Stat label="待確認" value={pendingCount} />
        <Stat label="持續配對" value={watchingCount} />
      </div>

      <div className="grid items-start rounded-2xl border border-zinc-200 bg-white shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ul className="border-b border-zinc-100 lg:sticky lg:top-16 lg:border-r lg:border-b-0">
          {guests.map((guest) => {
            const active = guest.id === selected?.id;
            const preview = guest.lines[guest.lines.length - 1]?.text ?? "";
            return (
              <li key={guest.id} className="border-b border-zinc-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(guest.id)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left ${active ? "bg-[#e7f8ee]" : "hover:bg-zinc-50"}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-sm font-bold text-white">
                    {guest.lineName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-zinc-900">{guest.lineName}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{preview}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <section className="flex flex-col border-t border-zinc-100 lg:border-t-0">
            <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-sm font-bold text-white">
                {selected.lineName.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-zinc-900">{selected.lineName}</p>
                <p className="text-xs text-zinc-500">LINE 顯示名稱 · {STATUS_LABEL[selected.status]}</p>
              </div>
            </header>
            <details className="border-b border-zinc-100 px-4 py-2 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700">這位客人的條件</summary>
              <div className="pt-3">
                <GuestFacts guest={selected} />
              </div>
            </details>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="flex flex-col">
                <div className="space-y-2 bg-[#8cabd9] px-3 py-3">
                  {selected.lines.map((line) => {
                    const outgoing = line.from !== "guest";
                    return (
                      <p
                        key={line.id}
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed text-zinc-900 ${
                          outgoing ? "ml-auto rounded-tr-sm bg-[#95ec69]" : "rounded-tl-sm bg-white"
                        }`}
                      >
                        {line.from === "staff" ? <span className="mb-1 block text-[11px] font-semibold text-[#067a36]">同事</span> : null}
                        {line.text}
                      </p>
                    );
                  })}
                </div>
                <form onSubmit={sendDraft} className="flex items-end gap-2 border-t border-zinc-200 bg-white px-3 py-2">
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
                      className="max-h-28 min-h-10 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#06c755]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label="傳送"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06c755] text-white disabled:opacity-40"
                  >
                    <SendIcon />
                  </button>
                </form>
                <p className="bg-white px-4 pb-2 text-[11px] leading-relaxed text-zinc-500">
                  預覽傳訊，不會送到{lineBasicId ? ` ${lineBasicId}` : "官方 LINE"}。
                </p>
              </div>
              <div className="hidden border-l border-zinc-100 px-4 py-4 lg:sticky lg:top-16 lg:block lg:self-start">
                <GuestFacts guest={selected} />
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <section className="rounded-2xl border border-[#0b2545]/15 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[#1e3a8a]">獨立名單</p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900">已選好物件與時間</h2>
          </div>
          <span className="rounded-full bg-[#0b2545] px-3 py-1 text-xs font-semibold text-white">{booked.length} 位</span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">物件和看屋時間都選完才會出現。同事跟業務或屋主對過之後，才能回客人這個時間可以，或改一個時間。</p>
        {booked.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">還沒有客人完成選擇</p>
        ) : (
          <ul className={`mt-4 grid gap-3 ${booked.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {booked.map((guest) => (
              <li key={guest.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <button type="button" onClick={() => setSelectedId(guest.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-base font-bold text-zinc-900">{guest.lineName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(guest.status)}`}>
                      {STATUS_LABEL[guest.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">LINE 顯示名稱</p>
                  <p className="mt-2 text-sm font-semibold text-[#0b2545]">{guest.requestedWhen}</p>
                  {guest.proposedWhen ? <p className="mt-1 text-sm text-sky-900">改問 {guest.proposedWhen}</p> : null}
                </button>
                <ul className="mt-3 space-y-1 text-sm">
                  {guest.picked.map((item) => (
                    <li key={item.id}>
                      <a href={`/listings/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-[#1e3a8a] hover:underline">
                        {item.title}
                      </a>
                      <span className="text-zinc-500"> · {formatRent(item.price)}</span>
                    </li>
                  ))}
                </ul>
                {guest.status === "pending_confirm" ? (
                  <div className="mt-4 space-y-2">
                    {editingId === guest.id ? (
                      <div className="space-y-2 rounded-xl bg-white p-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-zinc-600">改成這一天</span>
                          <input
                            type="date"
                            min={today}
                            value={editDate}
                            onChange={(event) => setEditDate(event.target.value)}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {VIEWING_SLOTS.map((slot) => {
                            const on = editSlot === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setEditSlot(slot.id)}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                                  on ? "border-[#06c755] bg-emerald-50 text-zinc-900" : "border-zinc-300 bg-white text-zinc-800"
                                }`}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!editDate || !editSlot}
                            onClick={() => sendNewTime(guest)}
                            className="rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                          >
                            送出改期
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => confirmTime(guest)}
                          className="rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white"
                        >
                          可以這個時間
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(guest.id);
                            setEditingId(guest.id);
                            setEditDate("");
                            setEditSlot("");
                          }}
                          className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
                        >
                          改時間
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#0b2545]/15 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[#1e3a8a]">持續配對</p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900">條件已記下，之後新案會問</h2>
          </div>
          <span className="rounded-full bg-[#0b2545] px-3 py-1 text-xs font-semibold text-white">{watches.length} 位</span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          填完條件就留在這裡。之後官網新上架且符合的物件，會自動傳訊問要不要看。已經看過的不會再傳。
        </p>
        <ul className={`mt-4 grid gap-3 ${watches.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {watches.map((guest) => (
            <li key={guest.id}>
              <button
                type="button"
                onClick={() => setSelectedId(guest.id)}
                className="w-full rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-base font-bold text-zinc-900">{guest.lineName}</p>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-950">盯著官網</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">LINE 顯示名稱</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700">{guest.criteriaText}</p>
                {guest.asks.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-zinc-800">
                    {guest.asks.map((ask) => (
                      <li key={ask.listingId}>
                        {ask.title}
                        <span className="text-zinc-500"> · {ask.answer === "yes" ? "想看" : ask.answer === "no" ? "先不用" : "尚未回覆"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">留下條件後還沒有新物件</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function GuestFacts({ guest }: { guest: StaffGuest }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs text-zinc-500">條件</dt>
        <dd className="mt-1 leading-relaxed text-zinc-800">{guest.criteriaText}</dd>
      </div>
      <div>
        <dt className="text-xs text-zinc-500">已勾物件</dt>
        <dd className="mt-1 text-zinc-800">
          {guest.picked.length
            ? guest.picked.map((item) => (
                <a key={item.id} href={`/listings/${item.id}`} target="_blank" rel="noopener noreferrer" className="block text-[#1e3a8a] hover:underline">
                  {item.title}
                  <span className="text-zinc-500"> · {formatRent(item.price)}</span>
                </a>
              ))
            : "還沒勾"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-zinc-500">希望時間</dt>
        <dd className="mt-1 text-zinc-800">{guest.requestedWhen || "還沒選"}</dd>
      </div>
      {guest.proposedWhen ? (
        <div>
          <dt className="text-xs text-zinc-500">改期提案</dt>
          <dd className="mt-1 text-zinc-800">{guest.proposedWhen}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M3.4 11.2 20.2 4.2c.7-.3 1.4.4 1.1 1.1l-7 16.8c-.3.8-1.4.8-1.7 0l-2.4-6.2-6.2-2.4c-.8-.3-.8-1.4 0-1.7z" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm sm:px-4">
      <p className="text-[11px] font-medium text-zinc-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#0b2545]">{value}</p>
    </div>
  );
}
