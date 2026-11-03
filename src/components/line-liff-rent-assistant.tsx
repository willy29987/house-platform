"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { LineLiffRentForm } from "@/components/line-liff-rent-form";
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
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [liffHint, setLiffHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!liffId) return;

    async function boot() {
      try {
        // 隧道／非正式 endpoint 上 init 可能卡住；加超時，表單不依賴它才能顯示
        await Promise.race([
          liff.init({ liffId }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("LIFF init timeout")), 2500);
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
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "LIFF 初始化失敗";
        setLiffHint(message);
        // 仍可填表；送出時若無法 sendMessages 會走 server push
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [liffId]);

  return (
    <>
      {liffHint ? (
        <p className="bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          LINE 身分讀取較慢／略過（{liffHint}），仍可繼續填表。
        </p>
      ) : null}
      <LineLiffRentForm
        listings={listings}
        liffId={liffId}
        lineUserId={lineUserId}
        displayName={displayName}
        listingBaseUrl={listingBaseUrl}
        onSubmitted={() => {
          if (liffId) {
            window.setTimeout(() => {
              try {
                if (liff.isInClient()) liff.closeWindow();
              } catch {
                /* ignore */
              }
            }, 1400);
          }
        }}
      />
    </>
  );
}
