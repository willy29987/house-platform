"use client";

import { useState } from "react";
import { LineGuestChatPreview } from "@/components/line-guest-chat-preview";
import { LineNativeChatPreview } from "@/components/line-native-chat-preview";
import { LineRentalPreview } from "@/components/line-rental-preview";
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
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
}) {
  const [tab, setTab] = useState<TabId>("staff");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 self-start">
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

      {tab === "staff" ? (
        <LineRentalPreview listings={listings} lineBasicId={lineBasicId} />
      ) : tab === "guest" ? (
        <LineGuestChatPreview listings={listings} lineBasicId={lineBasicId} />
      ) : (
        <LineNativeChatPreview listings={listings} lineBasicId={lineBasicId} />
      )}
    </div>
  );
}
