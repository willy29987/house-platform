"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { LineLiffRentForm } from "@/components/line-liff-rent-form";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentAssistant({
  listings,
  liffId,
}: {
  listings: RentalMatchListing[];
  lineBasicId?: string;
  liffId: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!liffId) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        await liff.init({ liffId });
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
          if (ctx?.userId) setLineUserId(ctx.userId);
        }
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
        載入找房表單…
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">{error}</p>
      ) : null}
      <LineLiffRentForm
        listings={listings}
        liffId={liffId}
        lineUserId={lineUserId}
        displayName={displayName}
        onSubmitted={() => {
          if (liffId && liff.isInClient()) {
            window.setTimeout(() => {
              try {
                liff.closeWindow();
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
