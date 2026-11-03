"use client";

import { useEffect, useState } from "react";
import { LineLiffRentForm } from "@/components/line-liff-rent-form";
import { loadLiffClient } from "@/lib/line-liff-client";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentAssistant({
  listings,
  liffId,
  listingBaseUrl,
}: {
  listings: RentalMatchListing[];
  lineBasicId?: string;
  liffId: string;
  listingBaseUrl: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!liffId) return;

    async function boot() {
      const liff = await loadLiffClient();
      if (!liff || cancelled) return;
      try {
        await Promise.race([
          liff.init({ liffId }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("timeout")), 2500);
          }),
        ]);
        if (cancelled) return;
        if (liff.isLoggedIn()) {
          try {
            const profile = await liff.getProfile();
            if (!cancelled) {
              setLineUserId(profile.userId);
              setDisplayName(profile.displayName);
            }
          } catch {
            const ctx = liff.getContext();
            if (!cancelled && ctx?.userId) setLineUserId(ctx.userId);
          }
        } else {
          const ctx = liff.getContext();
          if (!cancelled && ctx?.userId) setLineUserId(ctx.userId);
        }
      } catch {
        /* 表單不依賴 LIFF 身分 */
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
