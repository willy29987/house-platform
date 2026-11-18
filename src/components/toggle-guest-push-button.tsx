"use client";

import { useState } from "react";

type ToggleGuestPushButtonProps = {
  listingId: string;
  guestPushEnabled: boolean;
  buttonClassName?: string;
  wrapperClassName?: string;
};

export function ToggleGuestPushButton({
  listingId,
  guestPushEnabled,
  buttonClassName,
  wrapperClassName = "inline-flex items-center gap-1.5",
}: ToggleGuestPushButtonProps) {
  const [enabled, setEnabled] = useState(guestPushEnabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onToggle() {
    setLoading(true);
    setMessage("");
    const next = !enabled;
    const response = await fetch(`/api/admin/listings/${listingId}/guest-push`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestPushEnabled: next }),
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "更新失敗");
      setLoading(false);
      return;
    }
    setEnabled(next);
    setLoading(false);
  }

  const defaultButtonClass = enabled
    ? "rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
    : "rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 disabled:opacity-60";

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        onClick={() => void onToggle()}
        disabled={loading}
        title={enabled ? "目前會推播給符合條件的客人；點一下改成不推" : "目前不推播；點一下改成可推"}
        className={buttonClassName ?? defaultButtonClass}
      >
        {loading ? "更新中..." : enabled ? "可推播" : "不推播"}
      </button>
      {message ? <span className="text-xs text-rose-700">{message}</span> : null}
    </div>
  );
}
