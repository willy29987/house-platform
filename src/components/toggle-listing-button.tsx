"use client";

import { useState } from "react";

type ToggleListingButtonProps = {
  listingId: string;
  isPublished: boolean;
  listingType?: "RENT" | "SALE";
  buttonClassName?: string;
  wrapperClassName?: string;
};

export function ToggleListingButton({
  listingId,
  isPublished,
  listingType = "RENT",
  buttonClassName,
  wrapperClassName = "flex items-center gap-2",
}: ToggleListingButtonProps) {
  const [published, setPublished] = useState(isPublished);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState<"DEAL" | "PAUSE" | "OTHER">("DEAL");
  const [note, setNote] = useState("");
  const [releaseDate, setReleaseDate] = useState("");

  async function onToggle(payload?: { unpublishCategory?: "DEAL" | "PAUSE" | "OTHER"; unpublishNote?: string; expectedReleaseDate?: string }) {
    setLoading(true);
    setMessage("");

    const response = await fetch(`/api/admin/listings/${listingId}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !published, ...payload }),
    });

    const result = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "更新失敗");
      setLoading(false);
      return;
    }

    setPublished(!published);
    setLoading(false);
    setShowModal(false);
  }

  const defaultButtonClass = published
    ? "rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
    : "rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700";

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        onClick={() => {
          if (published && listingType === "RENT") {
            setShowModal(true);
            return;
          }
          void onToggle();
        }}
        disabled={loading}
        className={`disabled:opacity-60 ${buttonClassName ?? defaultButtonClass}`}
      >
        {loading ? "更新中..." : published ? "下架" : "上架"}
      </button>
      {message ? <span className="text-xs text-rose-700">{message}</span> : null}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900">租賃下架設定</h3>
            <p className="mt-1 text-xs text-zinc-500">
              下架時間會自動紀錄，請填寫類型；預計釋出日期與備註選填，可協助提前提醒。
            </p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs text-zinc-600">下架類型</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "DEAL" | "PAUSE" | "OTHER")}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                >
                  <option value="DEAL">成交下架</option>
                  <option value="PAUSE">暫時不出租</option>
                  <option value="OTHER">其他原因</option>
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-zinc-600">
                  預計釋出日期 <span className="text-zinc-400">（選填，將於 2 個月前提醒）</span>
                </p>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-zinc-600">備註原因 <span className="text-zinc-400">（選填）</span></p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-20 w-full rounded-md border border-zinc-300 px-2 py-1.5"
                  placeholder="例：屋主自住、整修、預計成交日…"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs">取消</button>
              <button
                type="button"
                onClick={() =>
                  void onToggle({
                    unpublishCategory: category,
                    unpublishNote: note.trim() || undefined,
                    expectedReleaseDate: releaseDate.trim() || undefined,
                  })
                }
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white"
              >
                確認下架
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
