"use client";

import { useEffect, useState } from "react";

type CasePayload = {
  id: string;
  status: string;
  displayName: string;
  requestedWhen: string;
  proposedWhen: string;
  picked: { id: string; title: string; price: number }[];
  canCancel: boolean;
  cancelledBy?: string | null;
  demo?: boolean;
};

export function LineViewingCancel({
  caseId,
  onCancelled,
}: {
  caseId: string;
  onCancelled?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [caseData, setCaseData] = useState<CasePayload | null>(null);
  const [lineUserId, setLineUserId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/line/viewing-cancel?caseId=${encodeURIComponent(caseId)}`, {
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

      // LIFF 身份另取，不擋畫面
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_RENT_ASSISTANT_ID?.trim();
      if (!liffId || typeof window === "undefined") return;
      try {
        const liff = (await import("@line/liff")).default;
        await Promise.race([
          liff.init({ liffId }),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("liff-timeout")), 2500)),
        ]);
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          if (!cancelled) setLineUserId(profile.userId || "");
        }
      } catch {
        // 預覽／非 LIFF 環境略過
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function confirmCancel() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/line/viewing-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          cancelledBy: "guest",
          lineUserId: lineUserId || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "取消失敗");
        return;
      }
      setDone(true);
      onCancelled?.();
    } catch {
      setError("取消失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto min-h-[100dvh] w-full max-w-md bg-white px-4 py-5">
        <div className="mb-4 h-7 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
        <p className="mt-4 text-center text-[11px] text-zinc-500">載入約看資料…</p>
      </div>
    );
  }

  if (error && !caseData) {
    return <p className="p-6 text-center text-sm text-red-600">{error}</p>;
  }

  if (done || caseData?.status === "cancelled") {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center bg-white px-6 py-10 text-center">
        <h1 className="text-xl font-bold text-[#0b2545]">已取消這次看屋</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          若之後想再約，回官方帳點「開始找房」即可重新預約。
        </p>
        {caseData?.demo ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            這是預覽示範，沒有真的取消案件。
          </p>
        ) : null}
      </div>
    );
  }

  if (!caseData?.canCancel) {
    return (
      <div className="mx-auto max-w-md space-y-2 p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">無法取消</h1>
        <p className="text-sm text-zinc-600">此約看已處理或不在可取消狀態。</p>
      </div>
    );
  }

  const when = caseData.proposedWhen || caseData.requestedWhen || "未填時段";

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-white">
      <header className="border-b border-zinc-100 px-4 py-4">
        <h1 className="text-lg font-bold text-[#0b2545]">取消這次預約</h1>
        <p className="mt-1 text-sm text-zinc-600">請確認以下時段與物件</p>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-xs font-medium text-zinc-500">看屋時間</p>
          <p className="mt-1 text-base font-semibold text-zinc-900">{when}</p>
          {caseData.picked.length ? (
            <ul className="mt-3 space-y-1.5 border-t border-zinc-200 pt-3">
              {caseData.picked.map((item) => (
                <li key={item.id} className="text-sm text-zinc-700">
                  · {item.title}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          取消後需重新預約。確定不要這個時間了嗎？
        </div>

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="space-y-2 border-t border-zinc-100 px-4 py-4">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void confirmCancel()}
          className="w-full rounded-xl bg-[#0b2545] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "取消中…" : "確定取消"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (typeof window !== "undefined") window.history.back();
          }}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800"
        >
          先保留
        </button>
      </div>
    </div>
  );
}
