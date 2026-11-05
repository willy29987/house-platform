"use client";

import { LineRentalPreview } from "@/components/line-rental-preview";
import type { LineConversation } from "@/lib/line-conversations";
import type { GuestSession } from "@/lib/line-guest-sessions";
import type { GuestWatchRecord } from "@/lib/line-guest-watch";
import type { LineRentalCase } from "@/lib/line-rental-cases";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

export function LineAssistantWorkbench({
  listings,
  lineBasicId,
  staffDisplayName,
  initialConversations = [],
  initialCases = [],
  initialSessions = [],
  initialWatches = [],
  initialProfileUserIds = [],
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
  staffDisplayName: string;
  initialConversations?: LineConversation[];
  initialCases?: LineRentalCase[];
  initialSessions?: GuestSession[];
  initialWatches?: GuestWatchRecord[];
  initialProfileUserIds?: string[];
}) {
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
