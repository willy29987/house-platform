"use client";

import { useEffect, useState } from "react";
import { LineLiffRentForm } from "@/components/line-liff-rent-form";
import { loadLiffClient } from "@/lib/line-liff-client";
import { readClientMessagingUid, type LiffBootstrapHint } from "@/lib/line-liff-id";
import type { LiffDirectListingEntry, RentalMatchListing } from "@/lib/line-rental-assistant";

function InstantShell({ mode }: { mode: LiffBootstrapHint["mode"] }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-zinc-100 px-4 pb-10 pt-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="h-6 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-200" />
      </div>
      {mode === "criteria" ? (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <div className="h-5 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
          <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
        </div>
      ) : mode === "book" ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="aspect-[4/3] animate-pulse bg-zinc-200" />
          <div className="space-y-3 p-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
              <div className="aspect-[16/9] animate-pulse bg-zinc-200" />
              <div className="space-y-2 p-3">
                <div className="h-5 w-4/5 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-2/5 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-[11px] text-zinc-500">找房頁載入中…</p>
    </div>
  );
}

export function LineLiffRentAssistant({
  liffId,
  listingBaseUrl,
  hint,
}: {
  liffId: string;
  listingBaseUrl: string;
  hint: LiffBootstrapHint;
}) {
  const [payload, setPayload] = useState<{
    listings: RentalMatchListing[];
    lineUserId: string | null;
    displayName: string | null;
    directListing: LiffDirectListingEntry | null;
  } | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const uid = readClientMessagingUid(null);
    const search = new URLSearchParams(window.location.search);
    if (uid && !search.get("uid")) search.set("uid", uid);

    async function load() {
      try {
        const res = await fetch(`/api/line/liff-bootstrap?${search.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          listings?: RentalMatchListing[];
          fallbackLineUserId?: string | null;
          initialDisplayName?: string | null;
          directListing?: LiffDirectListingEntry | null;
        };
        if (!res.ok || json.ok === false) {
          if (!cancelled) setBootError(json.message || "載入失敗，請稍後再試");
          return;
        }
        if (cancelled) return;
        const resolvedUid = readClientMessagingUid(json.fallbackLineUserId ?? null);
        setPayload({
          listings: json.listings ?? [],
          lineUserId: resolvedUid,
          displayName: json.initialDisplayName ?? null,
          directListing: json.directListing ?? null,
        });
      } catch {
        if (!cancelled) setBootError("網路異常，請關閉後重開");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!liffId || !payload) return;

    async function bootLiff() {
      const inLiffBrowser = /Line\/\d+\.\d+\.\d+ LIFF/.test(window.navigator.userAgent);
      if (!inLiffBrowser) return;
      const liff = await loadLiffClient();
      if (!liff || cancelled) return;
      try {
        await Promise.race([
          liff.init({ liffId }),
          new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 4000);
          }),
        ]);
      } catch {
        /* ignore */
      }
      if (cancelled || !liff.isLoggedIn()) return;
      try {
        const profile = await liff.getProfile();
        if (!cancelled && profile.displayName) {
          setPayload((prev) => (prev ? { ...prev, displayName: profile.displayName } : prev));
        }
      } catch {
        /* ignore */
      }
    }

    void bootLiff();
    return () => {
      cancelled = true;
    };
  }, [liffId, payload]);

  if (bootError) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-zinc-100 px-6 text-center">
        <p className="text-sm font-semibold text-zinc-900">{bootError}</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          重新載入
        </button>
      </div>
    );
  }

  if (!payload) {
    return <InstantShell mode={hint.mode} />;
  }

  return (
    <LineLiffRentForm
      listings={payload.listings}
      liffId={liffId}
      lineUserId={payload.lineUserId}
      displayName={payload.displayName}
      listingBaseUrl={listingBaseUrl}
      directListing={payload.directListing}
      onSubmitted={async () => {
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
