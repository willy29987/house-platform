"use client";

import { useState } from "react";

type ToggleListingButtonProps = {
  listingId: string;
  isPublished: boolean;
};

export function ToggleListingButton({ listingId, isPublished }: ToggleListingButtonProps) {
  const [published, setPublished] = useState(isPublished);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onToggle() {
    setLoading(true);
    setMessage("");

    const response = await fetch(`/api/admin/listings/${listingId}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !published }),
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "更新失敗");
      setLoading(false);
      return;
    }

    setPublished(!published);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
          published
            ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {loading ? "更新中..." : published ? "一鍵下架" : "一鍵上架"}
      </button>
      {message ? <span className="text-xs text-rose-700">{message}</span> : null}
    </div>
  );
}
