"use client";

import { useState } from "react";

type InquiryActionsProps = {
  inquiryId: string;
  isHandled: boolean;
  phone: string;
  message: string | null;
};

export function InquiryActions({
  inquiryId,
  isHandled,
  phone,
  message,
}: InquiryActionsProps) {
  const [handled, setHandled] = useState(isHandled);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function toggleHandled() {
    setLoading(true);
    setStatus("");

    const response = await fetch(`/api/admin/inquiries/${inquiryId}/handle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHandled: !handled }),
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setStatus(result.message ?? "更新失敗");
      setLoading(false);
      return;
    }

    setHandled(!handled);
    setLoading(false);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`已複製${label}`);
    } catch {
      setStatus(`複製${label}失敗`);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleHandled}
        disabled={loading}
        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
          handled
            ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {loading ? "更新中..." : handled ? "標記未處理" : "標記已處理"}
      </button>
      <button
        type="button"
        onClick={() => copyText(phone, "電話")}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        複製電話
      </button>
      <button
        type="button"
        onClick={() => copyText(message || "", "訊息")}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        複製訊息
      </button>
      <span
        className={`rounded-full px-2 py-1 text-xs ${
          handled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {handled ? "已處理" : "未處理"}
      </span>
      {status ? <span className="text-xs text-zinc-500">{status}</span> : null}
    </div>
  );
}
