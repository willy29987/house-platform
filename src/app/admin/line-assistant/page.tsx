import { redirect } from "next/navigation";
import { LineAssistantWorkbench } from "@/components/line-assistant-workbench";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { readLineConversations } from "@/lib/line-conversations";
import { listOpenGuestSessions } from "@/lib/line-guest-sessions";
import { getLineAccountLink } from "@/lib/line-official-account";
import { loadRentalMatchListings } from "@/lib/line-rental-assistant";
import { readLineRentalCases } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [cards, lineAccount, conversations, cases, sessions] = await Promise.all([
    loadRentalMatchListings(60),
    getLineAccountLink(),
    readLineConversations(),
    readLineRentalCases(),
    listOpenGuestSessions(),
  ]);

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] w-full flex-col gap-2 overflow-hidden sm:h-[calc(100dvh-8.5rem)] sm:max-h-[calc(100dvh-8.5rem)]">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">租屋配對客服</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {lineAccount.basicId || "官方帳號"}
            {" · "}
            對話內容以 LINE webhook 真實訊息為準（與聊天室同步）
            {lineAccount.live ? "（已開 LINE 推播）" : "（LINE 自動推播尚未開啟）"}
          </p>
        </div>
        {lineAccount.addFriendUrl ? (
          <a
            href={lineAccount.addFriendUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[#067a36] hover:underline"
          >
            打開官方帳號
          </a>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <LineAssistantWorkbench
          listings={cards}
          lineBasicId={lineAccount.basicId}
          staffDisplayName={current.displayName?.trim() || current.username}
          initialConversations={conversations}
          initialCases={cases}
          initialSessions={sessions}
        />
      </div>
    </div>
  );
}
