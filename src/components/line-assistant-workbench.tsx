"use client";

import { useEffect, useState } from "react";
import { LineRentalPreview } from "@/components/line-rental-preview";
import type { LineConversation } from "@/lib/line-conversations";
import type { GuestSession } from "@/lib/line-guest-sessions";
import type { GuestWatchRecord } from "@/lib/line-guest-watch";
import type { LineRentalCase } from "@/lib/line-rental-cases";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineAssistantWorkbench({
  listings: initialListings = [],
  lineBasicId,
  staffDisplayName,
  initialConversations = [],
  initialCases = [],
  initialSessions = [],
  initialWatches = [],
  initialProfileUserIds = [],
}: {
  listings?: RentalMatchListing[];
  lineBasicId: string;
  staffDisplayName: string;
  initialConversations?: LineConversation[];
  initialCases?: LineRentalCase[];
  initialSessions?: GuestSession[];
  initialWatches?: GuestWatchRecord[];
  initialProfileUserIds?: string[];
}) {
  const [listings, setListings] = useState(initialListings);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/line/rental-listings", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { listings?: RentalMatchListing[] };
        if (!cancelled && Array.isArray(data.listings)) setListings(data.listings);
      } catch {
        /* ignore — 推物件時沒有列表仍可回訊息 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <LineRentalPreview
        listings={listings}
        lineBasicId={lineBasicId}
        staffDisplayName={staffDisplayName}
        initialConversations={initialConversations}
        initialCases={initialCases}
        initialSessions={initialSessions}
        initialWatches={initialWatches}
        initialProfileUserIds={initialProfileUserIds}
      />
    </div>
  );
}
