"use client";

import { useEffect, useState } from "react";

type ListingShareActionsProps = {
  title: string;
};

export function ListingShareActions({ title }: ListingShareActionsProps) {
  const [status, setStatus] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const lineShareUrl = shareUrl
    ? `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`
    : "#";
  const fbShareUrl = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    : "#";

  async function copyLink() {
    if (!shareUrl) {
      setStatus("目前無法取得連結");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("已複製連結");
    } catch {
      setStatus("複製失敗");
    }
  }

  async function nativeShare() {
    if (!shareUrl || !navigator.share) {
      setStatus("此裝置不支援原生分享");
      return;
    }

    try {
      await navigator.share({
        title,
        url: shareUrl,
      });
      setStatus("");
    } catch {
      setStatus("分享已取消");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 p-3">
      <p className="text-xs font-semibold text-zinc-600">分享這個房源</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={lineShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-[#06C755] px-3 py-1.5 text-xs font-medium text-white"
        >
          分享到 LINE
        </a>
        <a
          href={fbShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-[#1877F2] px-3 py-1.5 text-xs font-medium text-white"
        >
          分享到 Facebook
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          複製連結
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          手機原生分享
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-zinc-500">{status}</p> : null}
    </div>
  );
}
