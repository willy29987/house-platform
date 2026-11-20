"use client";

import { useState } from "react";
import { format591ExpiryLabel, getDaysUntil591Expiry } from "@/lib/591-expiry";

const LABEL: Record<string, string> = {
  published: "591 刊登中",
  unpublished: "591 已下架",
  not_found: "591 找不到",
  needs_login: "591 需本機登入",
  sync_error: "591 同步失敗",
  unknown: "591 狀態未知",
};

export function AdminListing591Status(props: {
  listingId: string;
  listingType: string;
  source591Id?: string | null;
  source591Status?: string | null;
  source591SyncError?: string | null;
  source591CheckedAt?: string | null;
  source591ExpiresAt?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (props.listingType !== "RENT") return null;

  const status = props.source591Status || (props.source591Id ? "unknown" : "unknown");
  const label = props.source591Id ? LABEL[status] || status : "591 未連結";
  const tone =
    status === "published"
      ? "bg-emerald-50 text-emerald-800"
      : status === "needs_login" || status === "sync_error"
        ? "bg-red-50 text-red-800"
        : "bg-zinc-100 text-zinc-700";

  const days = getDaysUntil591Expiry(props.source591ExpiresAt);
  const expiryLabel = format591ExpiryLabel(props.source591ExpiresAt);
  const expiryTone =
    days == null
      ? ""
      : days <= 0
        ? "bg-rose-600 text-white"
        : days <= 3
          ? "bg-rose-100 text-rose-800"
          : days <= 7
            ? "bg-orange-100 text-orange-900"
            : "bg-zinc-100 text-zinc-600";

  async function act(action: "refresh_status" | "refresh_expiry" | "retry_listing") {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/591-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, listingId: props.listingId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.message || "失敗");
        return;
      }
      setMsg(
        action === "refresh_status"
          ? "已排程刷新"
          : action === "refresh_expiry"
            ? "已排程查到期"
            : "已排程整包同步",
      );
    } catch {
      setMsg("網路錯誤");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`} title={props.source591SyncError || ""}>
        {label}
      </span>
      {expiryLabel ? (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${expiryTone}`} title={props.source591ExpiresAt || ""}>
          {expiryLabel}
        </span>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void act("refresh_expiry")}
        className="text-[10px] text-zinc-500 underline-offset-2 hover:underline disabled:opacity-50"
      >
        查到期
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void act("refresh_status")}
        className="text-[10px] text-zinc-500 underline-offset-2 hover:underline disabled:opacity-50"
      >
        刷新
      </button>
      {msg ? <span className="text-[10px] text-zinc-500">{msg}</span> : null}
    </div>
  );
}
