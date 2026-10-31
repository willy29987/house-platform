"use client";

import { useMemo, useState } from "react";
import { viewingTimelineSlots } from "@/lib/line-rental-assistant";

export type ViewingScheduleValue = {
  date: string;
  start: string;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const TIMELINE_SLOTS = viewingTimelineSlots();

function ymdFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return null;
  return { year: y, monthIndex: m - 1, day: d };
}

function monthLabel(year: number, monthIndex: number) {
  return `${year}年${monthIndex + 1}月`;
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

function buildMonthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  // JS: Sun=0 … Sat=6 → Monday-first offset
  const mondayOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: ({ kind: "empty" } | { kind: "day"; day: number; ymd: string })[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push({ kind: "empty" });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ kind: "day", day, ymd: ymdFromParts(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "empty" });
  return cells;
}

export function ViewingSchedulePicker({
  value,
  onChange,
  minDate,
  submitLabel,
  onSubmit,
  onCancel,
  onBack,
  backLabel = "上一步",
  heading,
  dateOnly = false,
  compact = false,
}: {
  value: ViewingScheduleValue;
  onChange: (next: ViewingScheduleValue) => void;
  minDate: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  backLabel?: string;
  heading?: string;
  /** 只選日期，不顯示時段 */
  dateOnly?: boolean;
  /** 縮小月曆高度，並把題目固定在選單上方 */
  compact?: boolean;
}) {
  const initial = parseYmd(value.date || minDate) ?? parseYmd(minDate) ?? {
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth(),
    day: 1,
  };
  const [cursor, setCursor] = useState({ year: initial.year, monthIndex: initial.monthIndex });
  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.monthIndex), [cursor.year, cursor.monthIndex]);
  const canSubmit = dateOnly ? Boolean(value.date) : Boolean(value.date && value.start);
  const dayClass = compact
    ? "flex h-8 w-full items-center justify-center rounded-md text-xs font-medium transition"
    : "flex aspect-square w-full items-center justify-center rounded-lg text-sm font-medium transition";
  const selectedLabel = value.date
    ? dateOnly
      ? `已選 ${value.date.replaceAll("-", "/")}`
      : value.start
        ? `已選 ${value.date.replaceAll("-", "/")} ${value.start}`
        : `已選日期 ${value.date.replaceAll("-", "/")}`
    : dateOnly
      ? "點月曆選入住日"
      : "先選日期，再選時間";

  function pickDate(ymd: string) {
    if (ymd < minDate) return;
    onChange({ date: ymd, start: "" });
  }

  function pickTime(hm: string) {
    if (!value.date) return;
    onChange({ ...value, start: hm });
  }

  return (
    <div className={`flex flex-col text-sm ${compact ? "max-h-[22rem]" : "max-h-full"}`}>
      {heading ? (
        <div className="mb-2 shrink-0 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">{heading}</p>
          <p className="mt-0.5 text-xs text-slate-500">{selectedLabel}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        <div>
          <div className={`mb-1.5 flex items-center justify-between gap-2 ${compact ? "" : "mb-2"}`}>
            <button
              type="button"
              aria-label="上個月"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, -1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">{monthLabel(cursor.year, cursor.monthIndex)}</p>
            <button
              type="button"
              aria-label="下個月"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
            >
              ›
            </button>
          </div>
          <div
            className={`grid grid-cols-7 gap-0.5 text-center font-medium text-slate-500 ${
              compact ? "text-[10px]" : "gap-1 text-[11px]"
            }`}
          >
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-0.5">
                {day}
              </div>
            ))}
          </div>
          <div className={`mt-0.5 grid grid-cols-7 ${compact ? "gap-0.5" : "mt-1 gap-1"}`}>
            {cells.map((cell, index) => {
              if (cell.kind === "empty") {
                return <div key={`e-${index}`} className={compact ? "h-8" : "aspect-square"} />;
              }
              const disabled = cell.ymd < minDate;
              const selected = value.date === cell.ymd;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDate(cell.ymd)}
                  className={`${dayClass} ${
                    selected
                      ? "bg-[#0b2545] text-white"
                      : disabled
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {!dateOnly && value.date ? (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">
              {value.start ? `時段 ${value.start}` : "點選希望開始時間（每格 15 分）"}
            </p>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-[#f4f7fb] p-1">
              <div className="flex flex-col">
                {TIMELINE_SLOTS.map((hm) => {
                  const active = value.start === hm;
                  return (
                    <button
                      key={hm}
                      type="button"
                      onClick={() => pickTime(hm)}
                      className={`w-full rounded-md px-3 py-1.5 text-left text-sm tabular-nums ${
                        active
                          ? "bg-[#1e3a5f] font-semibold text-white"
                          : "text-slate-800 hover:bg-[#e8eef6]"
                      }`}
                    >
                      {hm}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-2">
        {onBack ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {backLabel}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="min-w-0 flex-1 rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitLabel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="rounded-full bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitLabel}
          </button>
        )}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            取消
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const emptyViewingSchedule = (): ViewingScheduleValue => ({ date: "", start: "" });
