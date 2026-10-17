"use client";

import { useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";

type ListingTopActionsProps = {
  listingId: string;
  title: string;
};

const actionBtn =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100";

export function ListingTopActions({ listingId, title }: ListingTopActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [status, setStatus] = useState("");

  function currentUrl() {
    return typeof window === "undefined" ? "" : window.location.href;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setStatus("已複製連結");
    } catch {
      setStatus("複製失敗");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      setStatus("此裝置不支援系統分享");
      return;
    }
    try {
      await navigator.share({ title, url: currentUrl() });
      setStatus("");
      setShareOpen(false);
    } catch {
      setStatus("分享已取消");
    }
  }

  const url = currentUrl();
  const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-1 print:hidden">
      <button type="button" onClick={() => window.print()} className={actionBtn}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinejoin="round" d="M7 8V3.5h10V8M7 17H4.5v-7.5h15V17H17M7 14h10v6.5H7z" />
        </svg>
        列印
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setStatus("");
            setShareOpen((open) => !open);
          }}
          aria-expanded={shareOpen}
          className={actionBtn}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3.5M8 7l4-4 4 4M5 12v8h14v-8" />
          </svg>
          分享
        </button>
        {shareOpen ? (
          <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
            <a
              href={lineShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              分享到 LINE
            </a>
            <a
              href={fbShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              分享到 Facebook
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            >
              複製連結
            </button>
            <button
              type="button"
              onClick={nativeShare}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            >
              手機系統分享
            </button>
            {status ? <p className="px-3 pb-1 pt-1 text-xs text-zinc-500">{status}</p> : null}
          </div>
        ) : null}
      </div>

      <span className="inline-flex items-center text-sm font-medium text-zinc-700">
        <FavoriteButton listingId={listingId} />
        收藏
      </span>
    </div>
  );
}
