"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { LineGuestChatPreview } from "@/components/line-guest-chat-preview";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentAssistant({
  listings,
  lineBasicId,
  liffId,
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
  liffId: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [doneHint, setDoneHint] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!liffId) {
        // 本機／未設定 LIFF ID：仍可測完整 UI
        if (!cancelled) {
          setReady(true);
          setError("尚未設定 NEXT_PUBLIC_LIFF_ID，目前以網頁預覽模式開啟。");
        }
        return;
      }

      try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        if (cancelled) return;
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "LIFF 初始化失敗");
        setReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [liffId]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 text-sm text-zinc-600">
        載入找房助理…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-2 bg-zinc-100 px-2 py-3">
      {error ? <p className="px-1 text-xs text-amber-800">{error}</p> : null}
      {doneHint ? <p className="px-1 text-xs text-emerald-800">{doneHint}</p> : null}
      <LineGuestChatPreview
        listings={listings}
        lineBasicId={lineBasicId}
        mode="liff"
        lineUserId={lineUserId}
        displayName={displayName}
        onSubmitted={() => {
          setDoneHint("案件已送出給客服。可關閉視窗回到 LINE 聊天室。");
          if (liffId && liff.isInClient()) {
            window.setTimeout(() => {
              try {
                liff.closeWindow();
              } catch {
                /* ignore */
              }
            }, 1600);
          }
        }}
      />
    </div>
  );
}
