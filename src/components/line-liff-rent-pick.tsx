"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";
import { formatViewingRange, type RentalMatchListing } from "@/lib/line-rental-assistant";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

function formatRent(price: number) {
  return `${price.toLocaleString("zh-TW")} 元/月`;
}

export function LineLiffRentPick({
  sessionId,
  listings,
  criteriaText,
  liffId,
}: {
  sessionId: string;
  listings: RentalMatchListing[];
  criteriaText: string;
  liffId: string;
}) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [doneSummary, setDoneSummary] = useState<{ when: string; titles: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!liffId) return;
    void liff.init({ liffId }).catch(() => {
      /* 仍可填寫 */
    });
  }, [liffId]);

  function toggle(id: string) {
    setPickedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function submit() {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) {
      setError("請先在上方選擇看屋時間");
      return;
    }
    if (!pickedIds.length) {
      setError("請至少勾選一間物件");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const picked = listings
        .filter((item) => pickedIds.includes(item.id))
        .map((item) => ({ id: item.id, title: item.title, price: item.price }));
      const response = await fetch("/api/line/guest-liff-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, picked, requestedWhen: when }),
      });
      const data = (await response.json()) as {
        error?: string;
        pushSent?: boolean;
        followUpMessages?: Array<Record<string, unknown>>;
      };
      if (!response.ok) {
        setError(data.error || "送出失敗");
        return;
      }
      // 伺服器 push 常因正式站缺 token 失敗；在 LINE App 內改用 sendMessages 回對話
      if (!data.pushSent && liffId) {
        try {
          if (liff.isInClient() && Array.isArray(data.followUpMessages) && data.followUpMessages.length) {
            await liff.sendMessages(data.followUpMessages as never);
          }
        } catch (sendError) {
          console.warn("[liff-rent-pick] sendMessages failed", sendError);
        }
      }
      setDoneSummary({ when, titles: picked.map((item) => item.title) });
      setDone(true);
      window.setTimeout(() => {
        try {
          if (liffId && liff.isInClient()) liff.closeWindow();
        } catch {
          /* ignore */
        }
      }, 1200);
    } catch {
      setError("送出失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 bg-zinc-100 px-4 text-center">
        <p className="text-lg font-bold text-zinc-900">已送出</p>
        {doneSummary ? (
          <div className="w-full rounded-2xl bg-white px-4 py-3 text-left text-sm text-zinc-700">
            <p>
              看屋時間：<span className="font-semibold text-zinc-900">{doneSummary.when}</span>
            </p>
            <p className="mt-2 font-semibold text-zinc-900">想看的物件</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {doneSummary.titles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-sm text-zinc-600">請回到 LINE 查看確認訊息，並繼續回答基本資料。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-zinc-900">選看屋時間與物件</h1>
        <p className="mt-1 text-xs text-zinc-500">{criteriaText || "依你的條件配對"}</p>
      </header>

      <section className="border-b border-zinc-200 bg-white px-3 py-3">
        <ViewingSchedulePicker
          heading="看屋時間（先選）"
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
      </section>

      <section className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <p className="text-sm font-semibold text-zinc-800">配對物件（可複選）</p>
        {listings.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-4 text-sm text-zinc-500">
            目前沒有完全符合的物件，請回 LINE 跟同事說，或放寬條件再試。
          </p>
        ) : (
          listings.map((item) => {
            const on = pickedIds.includes(item.id);
            const photo = item.coverImage || item.images[0];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full gap-3 rounded-2xl border bg-white p-3 text-left ${
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
                  <span className="block truncate text-sm font-bold text-zinc-900">{item.title}</span>
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
          })
        )}
      </section>

      <footer className="sticky bottom-0 border-t border-zinc-200 bg-white px-3 py-3">
        {error ? <p className="mb-2 text-center text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="w-full rounded-full bg-[#06c755] py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "送出中…" : "確認物件與時間"}
        </button>
      </footer>
    </div>
  );
}
