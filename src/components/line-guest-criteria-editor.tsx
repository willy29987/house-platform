"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuestProfile } from "@/lib/line-guest-profile";
import type { GuestWatchRecord } from "@/lib/line-guest-watch";
import {
  EXTRA_OPTIONS,
  RENT_PRICE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  emptyCriteria,
  type RentalExtra,
  type RentalMatchCriteria,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

const BATH_OPTS = [
  { id: "1", label: "1 衛" },
  { id: "2", label: "2 衛以上" },
] as const;

const PARK_OPTS = [
  { id: "yes", label: "要車位" },
  { id: "no", label: "不要車位" },
] as const;

const TWIN_CITY_NAMES = ["台北市", "新北市"] as const;

const TWIN_CITY_DISTRICTS = TWIN_CITY_NAMES.flatMap((city) => {
  const region = TAIWAN_REGIONS.find((row) => row.city === city);
  return (region?.districts ?? []).map((district) => ({ city, district }));
});

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function summaryOrUnlimited(values: string[], unlimited = "不限") {
  return values.length ? values.join("、") : unlimited;
}

type PickerOption = { id: string; label: string; hint?: string };

/** 點開後直排勾選（可複選／單選） */
function OptionPicker({
  label,
  summary,
  open,
  onToggleOpen,
  options,
  selectedIds,
  multi,
  unlimitedId = "__unlimited__",
  onPick,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggleOpen: () => void;
  options: PickerOption[];
  selectedIds: string[];
  multi: boolean;
  unlimitedId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className="w-14 shrink-0 text-[11px] font-medium text-zinc-500">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
          {summary}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-400">{open ? "收合" : "選擇"}</span>
      </button>
      {open ? (
        <ul className="max-h-52 overflow-y-auto border-t border-zinc-100">
          {options.map((option) => {
            const active =
              option.id === unlimitedId
                ? selectedIds.length === 0
                : selectedIds.includes(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => onPick(option.id)}
                  className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left text-sm ${
                    active
                      ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                      : "bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      active
                        ? "border-[#0b2545] bg-[#0b2545] text-white"
                        : "border-zinc-300 bg-white text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    {option.label}
                    {option.hint ? (
                      <span className="ml-1 text-[11px] font-normal text-zinc-400">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                  {!multi && active ? (
                    <span className="text-[11px] text-zinc-400">已選</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export type GuestCriteriaSaveResult = {
  watch: GuestWatchRecord;
  profile: GuestProfile | null;
  profileComplete: boolean;
};

type OpenKey =
  | "cities"
  | "districts"
  | "rooms"
  | "bathrooms"
  | "parking"
  | "budget"
  | "extras"
  | "pet"
  | "nationality"
  | null;

export function LineGuestCriteriaEditor({
  lineUserId,
  displayName,
  listings: _listings,
  seedProfile,
  onCancel,
  onSaved,
}: {
  lineUserId: string;
  displayName: string;
  listings: RentalMatchListing[];
  /** 右側面板已有的個資（案件／對話）當預填 */
  seedProfile?: {
    phone?: string;
    occupation?: string;
    nationality?: string;
    peopleCount?: number;
    petNote?: string;
    moveInDate?: string;
  };
  onCancel: () => void;
  onSaved: (result: GuestCriteriaSaveResult) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openKey, setOpenKey] = useState<OpenKey>(null);
  const [criteria, setCriteria] = useState<RentalMatchCriteria>(emptyCriteria);
  const [priceCustomOn, setPriceCustomOn] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [active, setActive] = useState(true);
  const [petHas, setPetHas] = useState<"no" | "yes" | null>(null);
  const [petDraft, setPetDraft] = useState("");
  const [phone, setPhone] = useState(seedProfile?.phone ?? "");
  const [occupation, setOccupation] = useState(seedProfile?.occupation ?? "");
  const [peopleCount, setPeopleCount] = useState(seedProfile?.peopleCount ?? 1);
  const [moveInDate, setMoveInDate] = useState(seedProfile?.moveInDate ?? "");
  const [nationalityLocal, setNationalityLocal] = useState<"local" | "other" | null>(null);
  const [nationalityDraft, setNationalityDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetch(
      `/api/admin/line-guest-criteria?lineUserId=${encodeURIComponent(lineUserId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json()) as {
          watch?: GuestWatchRecord | null;
          profile?: GuestProfile | null;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "載入失敗");
        if (cancelled) return;
        const watch = data.watch;
        const profile = data.profile;
        if (watch) {
          const cities = (watch.cities ?? []).filter((city) =>
            (TWIN_CITY_NAMES as readonly string[]).includes(city),
          );
          setCriteria({
            cities,
            districts: watch.districts ?? [],
            rooms: watch.rooms ?? [],
            bathrooms: watch.bathrooms ?? [],
            parking: watch.parking ?? [],
            priceKeys: watch.priceKeys ?? [],
            extras: (watch.extras ?? []) as RentalExtra[],
          });
          setActive(watch.active !== false);
          if (watch.priceMin != null || watch.priceMax != null) {
            setPriceCustomOn(true);
            setPriceMin(watch.priceMin != null ? String(watch.priceMin) : "");
            setPriceMax(watch.priceMax != null ? String(watch.priceMax) : "");
          }
          const pet = (watch.petNote || profile?.petNote || "").trim();
          if (pet === "沒有") {
            setPetHas("no");
            setPetDraft("");
          } else if (pet) {
            setPetHas("yes");
            setPetDraft(pet);
          }
        } else {
          const pet = (seedProfile?.petNote || "").trim();
          if (pet === "沒有") setPetHas("no");
          else if (pet) {
            setPetHas("yes");
            setPetDraft(pet);
          }
        }
        const nextPhone = profile?.phone || seedProfile?.phone || "";
        const nextOccupation = profile?.occupation || seedProfile?.occupation || "";
        const nextPeople = profile?.peopleCount || seedProfile?.peopleCount || 1;
        const nextMoveIn = profile?.moveInDate || seedProfile?.moveInDate || "";
        const nation = (profile?.nationality || seedProfile?.nationality || "").trim();
        setPhone(nextPhone);
        setOccupation(nextOccupation);
        setPeopleCount(nextPeople);
        setMoveInDate(nextMoveIn);
        if (nation === "本國") {
          setNationalityLocal("local");
          setNationalityDraft("");
        } else if (nation) {
          setNationalityLocal("other");
          setNationalityDraft(nation);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "載入失敗");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    lineUserId,
    seedProfile?.phone,
    seedProfile?.occupation,
    seedProfile?.nationality,
    seedProfile?.peopleCount,
    seedProfile?.petNote,
    seedProfile?.moveInDate,
  ]);

  const districtOptions = useMemo(() => {
    const selectedCities = criteria.cities;
    const rows =
      selectedCities.length === 0
        ? TWIN_CITY_DISTRICTS
        : TWIN_CITY_DISTRICTS.filter((row) => selectedCities.includes(row.city));
    return [
      { id: "__unlimited__", label: "不限" },
      ...rows.map((row) => ({
        id: row.district,
        label: row.district,
        hint: selectedCities.length === 1 ? undefined : row.city,
      })),
    ];
  }, [criteria.cities]);

  const petNote =
    petHas === "no" ? "沒有" : petHas === "yes" ? petDraft.trim() : "";
  const nationality =
    nationalityLocal === "local"
      ? "本國"
      : nationalityLocal === "other"
        ? nationalityDraft.trim()
        : "";

  const budgetSummary = priceCustomOn
    ? `自訂 ${priceMin || "不限"}～${priceMax || "不限"}`
    : summaryOrUnlimited(
        criteria.priceKeys.map(
          (key) => RENT_PRICE_OPTIONS.find((o) => o.value === key)?.label ?? key,
        ),
        "月租不限",
      );

  const parkingSummary =
    !criteria.parking.length || criteria.parking.includes("any")
      ? "不限"
      : criteria.parking
          .map((id) => PARK_OPTS.find((o) => o.id === id)?.label ?? id)
          .join("、");

  function toggleOpen(key: OpenKey) {
    setOpenKey((current) => (current === key ? null : key));
  }

  async function handleSave() {
    if (petHas === "yes" && !petDraft.trim()) {
      setError("有養寵物請填寫說明");
      return;
    }
    if (nationalityLocal === "other" && !nationalityDraft.trim()) {
      setError("請填寫國籍");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customMin = priceCustomOn && priceMin.trim() ? Number(priceMin) : null;
      const customMax = priceCustomOn && priceMax.trim() ? Number(priceMax) : null;
      const response = await fetch("/api/admin/line-guest-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          displayName,
          criteria: priceCustomOn ? { ...criteria, priceKeys: [] } : criteria,
          priceMin: priceCustomOn ? customMin : null,
          priceMax: priceCustomOn ? customMax : null,
          petNote,
          active,
          profile: {
            phone: phone.trim(),
            occupation: occupation.trim(),
            nationality,
            peopleCount,
            petNote,
            moveInDate: moveInDate.trim(),
          },
        }),
      });
      const data = (await response.json()) as GuestCriteriaSaveResult & { error?: string };
      if (!response.ok || !data.watch) {
        throw new Error(data.error || "儲存失敗");
      }
      onSaved({
        watch: data.watch,
        profile: data.profile ?? null,
        profileComplete: Boolean(data.profileComplete),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">載入條件…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#0b2545]">調整找房條件／資料</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          取消
        </button>
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <section className="min-w-0 space-y-2">
          <p className="text-xs font-semibold text-zinc-500">找房條件</p>

          <OptionPicker
            label="縣市"
            summary={summaryOrUnlimited(criteria.cities)}
            open={openKey === "cities"}
            onToggleOpen={() => toggleOpen("cities")}
            multi
            options={[
              { id: "__unlimited__", label: "不限" },
              ...TWIN_CITY_NAMES.map((city) => ({ id: city, label: city })),
            ]}
            selectedIds={criteria.cities}
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, cities: [], districts: [] }));
                return;
              }
              setCriteria((c) => {
                const nextCities = toggleIn(c.cities, id);
                const allowed = new Set(
                  TWIN_CITY_DISTRICTS.filter((row) =>
                    nextCities.length === 0 ? true : nextCities.includes(row.city),
                  ).map((row) => row.district),
                );
                return {
                  ...c,
                  cities: nextCities,
                  districts: c.districts.filter((d) => allowed.has(d)),
                };
              });
            }}
          />

          <OptionPicker
            label="行政區"
            summary={summaryOrUnlimited(criteria.districts)}
            open={openKey === "districts"}
            onToggleOpen={() => toggleOpen("districts")}
            multi
            options={districtOptions}
            selectedIds={criteria.districts}
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, districts: [] }));
                return;
              }
              setCriteria((c) => ({ ...c, districts: toggleIn(c.districts, id) }));
            }}
          />

          <OptionPicker
            label="房型"
            summary={summaryOrUnlimited(
              criteria.rooms.map(
                (id) => ROOM_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id,
              ),
            )}
            open={openKey === "rooms"}
            onToggleOpen={() => toggleOpen("rooms")}
            multi
            options={[
              { id: "__unlimited__", label: "不限" },
              ...ROOM_TYPE_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
            ]}
            selectedIds={criteria.rooms}
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, rooms: [] }));
                return;
              }
              setCriteria((c) => ({ ...c, rooms: toggleIn(c.rooms, id) }));
            }}
          />

          <OptionPicker
            label="衛浴"
            summary={summaryOrUnlimited(
              criteria.bathrooms.map(
                (id) => BATH_OPTS.find((o) => o.id === id)?.label ?? id,
              ),
            )}
            open={openKey === "bathrooms"}
            onToggleOpen={() => toggleOpen("bathrooms")}
            multi
            options={[
              { id: "__unlimited__", label: "不限" },
              ...BATH_OPTS.map((o) => ({ id: o.id, label: o.label })),
            ]}
            selectedIds={criteria.bathrooms}
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, bathrooms: [] }));
                return;
              }
              setCriteria((c) => ({ ...c, bathrooms: toggleIn(c.bathrooms, id) }));
            }}
          />

          <OptionPicker
            label="車位"
            summary={parkingSummary}
            open={openKey === "parking"}
            onToggleOpen={() => toggleOpen("parking")}
            multi={false}
            options={[
              { id: "__unlimited__", label: "不限" },
              ...PARK_OPTS.map((o) => ({ id: o.id, label: o.label })),
            ]}
            selectedIds={
              !criteria.parking.length || criteria.parking.includes("any")
                ? []
                : criteria.parking
            }
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, parking: [] }));
                return;
              }
              setCriteria((c) => ({ ...c, parking: [id] }));
              setOpenKey(null);
            }}
          />

          <div className="rounded-lg border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => toggleOpen("budget")}
              className="flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left"
            >
              <span className="w-14 shrink-0 text-[11px] font-medium text-zinc-500">預算</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                {budgetSummary}
              </span>
              <span className="shrink-0 text-[11px] text-zinc-400">
                {openKey === "budget" ? "收合" : "選擇"}
              </span>
            </button>
            {openKey === "budget" ? (
              <ul className="max-h-56 overflow-y-auto border-t border-zinc-100">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceCustomOn(false);
                      setPriceMin("");
                      setPriceMax("");
                      setCriteria((c) => ({ ...c, priceKeys: [] }));
                    }}
                    className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left text-sm ${
                      !priceCustomOn && criteria.priceKeys.length === 0
                        ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                        : "hover:bg-zinc-50"
                    }`}
                  >
                    不限
                  </button>
                </li>
                {RENT_PRICE_OPTIONS.map((o) => {
                  const activeBand = !priceCustomOn && criteria.priceKeys.includes(o.value);
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setPriceCustomOn(false);
                          setPriceMin("");
                          setPriceMax("");
                          setCriteria((c) => ({
                            ...c,
                            priceKeys: toggleIn(c.priceKeys, o.value),
                          }));
                        }}
                        className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left text-sm ${
                          activeBand
                            ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                            : "hover:bg-zinc-50"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            activeBand
                              ? "border-[#0b2545] bg-[#0b2545] text-white"
                              : "border-zinc-300 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        {o.label}
                      </button>
                    </li>
                  );
                })}
                <li className="border-t border-zinc-100 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCriteria((c) => ({ ...c, priceKeys: [] }));
                      setPriceCustomOn(true);
                    }}
                    className={`mb-2 text-sm ${
                      priceCustomOn ? "font-semibold text-[#0b2545]" : "text-zinc-700"
                    }`}
                  >
                    自訂金額
                  </button>
                  {priceCustomOn ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="最低"
                        className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                      />
                      <span className="text-xs text-zinc-400">～</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="最高"
                        className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                  ) : null}
                </li>
              </ul>
            ) : null}
          </div>

          <OptionPicker
            label="其他"
            summary={summaryOrUnlimited(
              criteria.extras.map(
                (id) => EXTRA_OPTIONS.find((o) => o.id === id)?.label ?? id,
              ),
              "租補／報稅／入籍不限",
            )}
            open={openKey === "extras"}
            onToggleOpen={() => toggleOpen("extras")}
            multi
            options={[
              { id: "__unlimited__", label: "不限" },
              ...EXTRA_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
            ]}
            selectedIds={criteria.extras}
            onPick={(id) => {
              if (id === "__unlimited__") {
                setCriteria((c) => ({ ...c, extras: [] }));
                return;
              }
              setCriteria((c) => ({
                ...c,
                extras: toggleIn(c.extras, id) as RentalExtra[],
              }));
            }}
          />

          <label className="flex items-center gap-2 px-0.5 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            之後新案符合條件要推播問他
          </label>
        </section>

        <section className="min-w-0 space-y-2">
          <p className="text-xs font-semibold text-zinc-500">基本資料</p>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">電話</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              className="min-h-9 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">人數</span>
            <select
              value={peopleCount}
              onChange={(e) => setPeopleCount(Number(e.target.value))}
              className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} 人
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">職業</span>
            <input
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="min-h-9 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-500">預計入住</span>
            <input
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="rounded-lg border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => toggleOpen("nationality")}
              className="flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left"
            >
              <span className="w-14 shrink-0 text-[11px] font-medium text-zinc-500">國籍</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                {nationalityLocal === "local"
                  ? "本國"
                  : nationalityLocal === "other"
                    ? nationalityDraft.trim() || "其他（請填）"
                    : "未選"}
              </span>
              <span className="shrink-0 text-[11px] text-zinc-400">
                {openKey === "nationality" ? "收合" : "選擇"}
              </span>
            </button>
            {openKey === "nationality" ? (
              <div className="space-y-2 border-t border-zinc-100 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setNationalityLocal("local");
                    setNationalityDraft("");
                    setOpenKey(null);
                  }}
                  className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm ${
                    nationalityLocal === "local"
                      ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  本國
                </button>
                <button
                  type="button"
                  onClick={() => setNationalityLocal("other")}
                  className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm ${
                    nationalityLocal === "other"
                      ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  其他
                </button>
                {nationalityLocal === "other" ? (
                  <input
                    value={nationalityDraft}
                    onChange={(e) => setNationalityDraft(e.target.value)}
                    placeholder="國籍"
                    className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => toggleOpen("pet")}
              className="flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left"
            >
              <span className="w-14 shrink-0 text-[11px] font-medium text-zinc-500">寵物</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                {petHas === "no"
                  ? "沒有"
                  : petHas === "yes"
                    ? petDraft.trim() || "有（請填說明）"
                    : "未選"}
              </span>
              <span className="shrink-0 text-[11px] text-zinc-400">
                {openKey === "pet" ? "收合" : "選擇"}
              </span>
            </button>
            {openKey === "pet" ? (
              <div className="space-y-2 border-t border-zinc-100 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setPetHas("no");
                    setPetDraft("");
                    setOpenKey(null);
                  }}
                  className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm ${
                    petHas === "no"
                      ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  沒有
                </button>
                <button
                  type="button"
                  onClick={() => setPetHas("yes")}
                  className={`flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm ${
                    petHas === "yes"
                      ? "bg-[#eef3f9] font-semibold text-[#0b2545]"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  有
                </button>
                {petHas === "yes" ? (
                  <input
                    value={petDraft}
                    onChange={(e) => setPetDraft(e.target.value)}
                    placeholder="例如：小型犬"
                    className="min-h-9 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="w-full rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "儲存中…" : "儲存條件"}
      </button>
    </div>
  );
}
