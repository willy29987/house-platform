"use client";

import { useEffect, useMemo, useState } from "react";
import { formatViewingRange } from "@/lib/line-rental-assistant";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";

type CasePayload = {
  id: string;
  status: string;
  displayName: string;
  phone: string;
  requestedWhen: string;
  proposedWhen: string;
  criteriaText: string;
  canPropose: boolean;
  picked: { id: string; title: string; price: number }[];
};

export function LineAgentReschedule({ caseId }: { caseId: string }) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [caseData, setCaseData] = useState<CasePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/line/agent-reschedule?caseId=${encodeURIComponent(caseId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as CasePayload & { error?: string };
        if (!response.ok) {
          if (!cancelled) setError(data.error || "載入失敗");
          return;
        }
        if (!cancelled) setCaseData(data);
      } catch {
        if (!cancelled) setError("載入失敗，請稍後再試");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function submit() {
    const when = formatViewingRange(schedule.date, schedule.start);
    if (!when) {
      setError("請先選日期與開始時間");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/line/agent-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, proposedWhen: when }),
      });
      const data = (await response.json()) as { error?: string; case?: { proposedWhen?: string } };
      if (!response.ok) {
        setError(data.error || "送出失敗");
        return;
      }
      setDoneWhen(data.case?.proposedWhen || when);
    } catch {
      setError("送出失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-center text-sm text-zinc-500">載入約看資料…</p>;
  }

  if (error && !caseData) {
    return <p className="p-6 text-center text-sm text-red-600">{error}</p>;
  }

  if (doneWhen) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">已送出新時間</h1>
        <p className="text-sm text-zinc-600">
          已建議客人改為 <span className="font-semibold text-[#0b2545]">{doneWhen}</span>，等待客人確認。
        </p>
      </div>
    );
  }

  if (!caseData?.canPropose) {
    return (
      <div className="mx-auto max-w-md space-y-2 p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">無法改時間</h1>
        <p className="text-sm text-zinc-600">此約看已處理或不在可改約狀態。</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-white">
      <header className="border-b border-zinc-100 px-4 py-3">
        <h1 className="text-lg font-bold text-zinc-900">業務改約時間</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {caseData.displayName}
          {caseData.picked[0] ? ` · ${caseData.picked[0].title}` : ""}
        </p>
        <p className="mt-1 text-xs text-zinc-500">客人原希望：{caseData.requestedWhen || "未填"}</p>
      </header>
      <div className="min-h-0 flex-1 px-3 py-3">
        <ViewingSchedulePicker
          heading="選新的看屋時間"
          value={schedule}
          onChange={setSchedule}
          minDate={today}
          submitLabel={submitting ? "送出中…" : "送給客人確認"}
          onSubmit={() => {
            if (!submitting) void submit();
          }}
        />
        {error ? <p className="mt-2 text-center text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
