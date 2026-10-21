"use client";

import { useMemo, useState } from "react";
import {
  addDaysYmd,
  normalizeNextContactDate,
  taipeiTodayYmd,
} from "@/lib/owner-tracking-next-contact";

const DAY_PRESETS = [2, 7] as const;

type Props = {
  value: string;
  onChange: (ymd: string) => void;
  compact?: boolean;
};

export function OwnerTrackingNextContactField({ value, onChange, compact: _compact = false }: Props) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const normalized = normalizeNextContactDate(value);
  const [showDate, setShowDate] = useState(false);

  const isPreset =
    !!normalized && DAY_PRESETS.some((d) => normalized === addDaysYmd(today, d));
  const isCustom = !!normalized && !isPreset;
  const showPicker = showDate || isCustom || isPreset;

  function pickDays(days: number) {
    onChange(addDaysYmd(today, days));
    setShowDate(false);
  }

  function pickNone() {
    onChange("");
    setShowDate(false);
  }

  function openCustomDate() {
    setShowDate(true);
    if (!normalized) onChange(today);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
      <span className="shrink-0 text-xs font-medium text-zinc-600">下次聯繫</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={pickNone}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            !normalized
              ? "border-[#0b2545] bg-[#0b2545] text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          不設定
        </button>
        {DAY_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pickDays(d)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              normalized === addDaysYmd(today, d)
                ? "border-[#0b2545] bg-[#0b2545] text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {d} 天後
          </button>
        ))}
        <button
          type="button"
          onClick={openCustomDate}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            showDate || isCustom
              ? "border-[#1e3a8a] bg-[#1e3a8a]/10 text-[#1e3a8a]"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          指定日期
        </button>
        {showPicker ? (
          <label className="block max-w-[11rem] min-w-[9.5rem] shrink-0">
            <span className="sr-only">指定下次聯繫日期</span>
            <input
              type="date"
              min={today}
              value={normalized || ""}
              onChange={(e) => {
                setShowDate(true);
                onChange(normalizeNextContactDate(e.target.value));
              }}
              className="h-[34px] w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
