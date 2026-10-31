"use client";

import { useEffect, useState } from "react";
import { LineLiffRentPick } from "@/components/line-liff-rent-pick";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineLiffRentPickClient({
  sessionId,
  liffId,
}: {
  sessionId: string;
  liffId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listings, setListings] = useState<RentalMatchListing[]>([]);
  const [criteriaText, setCriteriaText] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/line/guest-session?session=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          error?: string;
          listings?: RentalMatchListing[];
          criteriaText?: string;
        };
        if (!response.ok) {
          if (!cancelled) setError(data.error || "載入失敗");
          return;
        }
        if (!cancelled) {
          setListings(data.listings ?? []);
          setCriteriaText(data.criteriaText ?? "");
        }
      } catch {
        if (!cancelled) setError("載入失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-100 text-sm text-zinc-600">
        載入配對物件…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <LineLiffRentPick
      sessionId={sessionId}
      listings={listings}
      criteriaText={criteriaText}
      liffId={liffId}
    />
  );
}
