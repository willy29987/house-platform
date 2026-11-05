"use client";

import { useState } from "react";
import { LineGuestChatPreview } from "@/components/line-guest-chat-preview";
import { LineNativeChatPreview } from "@/components/line-native-chat-preview";
import { LineRentalPreview } from "@/components/line-rental-preview";
import type { LineConversation } from "@/lib/line-conversations";
import type { GuestSession } from "@/lib/line-guest-sessions";
import type { GuestWatchRecord } from "@/lib/line-guest-watch";
import type { LineRentalCase } from "@/lib/line-rental-cases";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

type TabId = "staff" | "guest" | "native";

const TABS: { id: TabId; label: string }[] = [
  { id: "staff", label: "客服收件匣" },
  { id: "guest", label: "客人對話" },
  { id: "native", label: "LINE 樣貌參考" },
];

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
  const [tab, setTab] = useState<TabId>("staff");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap gap-1 self-start rounded-full border border-zinc-200 bg-zinc-50 p-1">
        {TABS.map((item) => {
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                on ? "bg-[#0b2545] text-white" : "text-zinc-600 hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "staff" ? (
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
        ) : tab === "guest" ? (
          <div className="h-full overflow-y-auto">
            <LineGuestChatPreview listings={listings} lineBasicId={lineBasicId} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <LineNativeChatPreview listings={listings} lineBasicId={lineBasicId} />
          </div>
        )}
      </div>
    </div>
  );
}
