"use client";

import { useId, useMemo, useState } from "react";
import {
  addDaysYmd,
  normalizeNextContactDate,
  taipeiTodayYmd,
} from "@/lib/owner-tracking-next-contact";

const DAY_PRESETS = [1, 3, 7, 14, 30] as const;

type Props = {
  value: string;
  onChange: (ymd: string) => void;
  compact?: boolean;
};

export function OwnerTrackingNextContactField({ value, onChange, compact = false }: Props) {
  const detailsId = useId();
  const today = useMemo(() => taipeiTodayYmd(), []);
  const normalized = normalizeNextContactDate(value);
  const [showDate, setShowDate] = useState(false);

  function pickDays(days: number) {
    onChange(addDaysYmd(today, days));
    setShowDate(false);
  }

  function pickNone() {
    onChange("");
    setShowDate(false);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <span className="block text-xs font-medium text-zinc-600">下次聯繫</span>
      <div className="flex flex-wrap gap-1.5">
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
          onClick={() => setShowDate((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
            showDate || (normalized && !DAY_PRESETS.some((d) => normalized === addDaysYmd(today, d)))
              ? "border-[#1e3a8a] bg-[#1e3a8a]/10 text-[#1e3a8a]"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          指定日期
        </button>
      </div>
      {showDate ? (
        <label className="block max-w-[14rem]">
          <span className="sr-only">指定下次聯繫日期</span>
          <input
            type="date"
            min={today}
            value={normalized || ""}
            onChange={(e) => onChange(normalizeNextContactDate(e.target.value))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            aria-describedby={detailsId}
          />
        </label>
      ) : null}
      {normalized ? (
        <p id={detailsId} className="text-xs text-zinc-500">
          已排程：<span className="font-medium tabular-nums text-zinc-700">{normalized}</span>
        </p>
      ) : (
        <p id={detailsId} className="text-xs text-zinc-400">
          未設定時不會出現在「今日待聯繫」篩選。
        </p>
      )}
    </div>
  );
}
