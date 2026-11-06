"use client";

import { useEffect, useState } from "react";
import { LineLiffRentForm, type LiffDirectListingEntry } from "@/components/line-liff-rent-form";
import { loadLiffClient } from "@/lib/line-liff-client";
import { readClientMessagingUid } from "@/lib/line-liff-id";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentAssistant({
  listings,
  liffId,
  listingBaseUrl,
  fallbackLineUserId = null,
  lineBasicId = "@878thkii",
  directListing = null,
}: {
  listings: RentalMatchListing[];
  lineBasicId?: string;
  liffId: string;
  listingBaseUrl: string;
  fallbackLineUserId?: string | null;
  /** 已有找房條件、又從推播點進物件時，直接開物件頁 */
  directListing?: LiffDirectListingEntry | null;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(fallbackLineUserId);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    const uid = readClientMessagingUid(fallbackLineUserId);
    if (uid) setLineUserId(uid);
  }, [fallbackLineUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!liffId) return;

    async function boot() {
      // 開發中的 LIFF 頻道會把一般客人導到 400 認證頁。只有已經在 LIFF 瀏覽器裡才初始化。
      const inLiffBrowser = /Line\/\d+\.\d+\.\d+ LIFF/.test(window.navigator.userAgent);
      if (!inLiffBrowser) return;
      const liff = await loadLiffClient();
      if (!liff || cancelled) return;
      try {
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

      // 只取顯示名稱；userId 堅持用 Messaging uid（與 Login channel 的 profile.userId 不同）
      if (liff.isLoggedIn()) {
        try {
          const profile = await liff.getProfile();
          if (!cancelled) setDisplayName(profile.displayName);
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
      lineBasicId={lineBasicId}
      directListing={directListing}
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
