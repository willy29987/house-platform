"use client";

import { useEffect, useState } from "react";
import { LineLiffRentForm } from "@/components/line-liff-rent-form";
import { loadLiffClient } from "@/lib/line-liff-client";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentAssistant({
  listings,
  liffId,
  listingBaseUrl,
  fallbackLineUserId = null,
}: {
  listings: RentalMatchListing[];
  lineBasicId?: string;
  liffId: string;
  listingBaseUrl: string;
  fallbackLineUserId?: string | null;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(fallbackLineUserId);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("uid")?.trim();
      const fromStore = window.sessionStorage.getItem("line_liff_uid")?.trim();
      const uid = fromUrl || fromStore || fallbackLineUserId;
      if (uid) {
        window.sessionStorage.setItem("line_liff_uid", uid);
        setLineUserId((current) => current || uid);
      }
    } catch {
      /* ignore */
    }
  }, [fallbackLineUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!liffId) return;

    async function boot() {
      const liff = await loadLiffClient();
      if (!liff || cancelled) return;
      try {
        // 不硬砍 init：超時仍繼續讀 context，否則 lineUserId 會是空的、後端推播失敗
        await Promise.race([
          liff.init({ liffId }),
          new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 8000);
          }),
        ]);
      } catch {
        /* 可能已 init 或暫時失敗 */
      }
      if (cancelled) return;

      try {
        const ctx = liff.getContext();
        if (ctx?.userId) {
          window.sessionStorage.setItem("line_liff_uid", ctx.userId);
          setLineUserId(ctx.userId);
        }
      } catch {
        /* ignore */
      }

      if (liff.isLoggedIn()) {
        try {
          const profile = await liff.getProfile();
          if (!cancelled) {
            setLineUserId(profile.userId);
            setDisplayName(profile.displayName);
            window.sessionStorage.setItem("line_liff_uid", profile.userId);
          }
        } catch {
          /* ignore */
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [liffId]);

  if (!hydrated) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-zinc-100 px-6 text-center">
        <p className="text-sm font-semibold text-zinc-900">載入找房表單中…</p>
        <p className="mt-2 text-xs text-zinc-500">請稍候，選項準備好才能點選</p>
      </div>
    );
  }

  return (
    <LineLiffRentForm
      listings={listings}
      liffId={liffId}
      lineUserId={lineUserId}
      displayName={displayName}
      listingBaseUrl={listingBaseUrl}
      onSubmitted={async () => {
        // 表單內已 closeWindow；此處僅備援
        if (!liffId) return;
        try {
          const liff = await loadLiffClient();
          if (liff?.isInClient()) liff.closeWindow();
        } catch {
          /* ignore */
        }
      }}
    />
  );
}
