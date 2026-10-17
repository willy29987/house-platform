"use client";

import { useEffect } from "react";

export default function OwnerTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[owner-tracking]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-bold text-zinc-900">屋主追蹤無法載入</h1>
      <p className="mt-2 text-sm text-zinc-600">
        可能是雲端資料格式或網路問題。請重新整理；若仍失敗，請用最高管理員帳號回報或稍後再試。
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
        >
          再試一次
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          重新整理
        </button>
      </div>
    </div>
  );
}
