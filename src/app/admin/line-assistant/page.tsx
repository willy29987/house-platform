import { redirect } from "next/navigation";
import { LineAssistantWorkbench } from "@/components/line-assistant-workbench";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { readLineConversations } from "@/lib/line-conversations";
import { getLineAccountLink } from "@/lib/line-official-account";
import { loadRentalMatchListings } from "@/lib/line-rental-assistant";
import { readLineRentalCases } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [cards, lineAccount, conversations, cases] = await Promise.all([
    loadRentalMatchListings(60),
    getLineAccountLink(),
    readLineConversations(),
    readLineRentalCases(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">租屋配對客服</h1>
          <p className="mt-1 text-sm text-zinc-500">
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
      <LineAssistantWorkbench
        listings={cards}
        lineBasicId={lineAccount.basicId}
        initialConversations={conversations}
        initialCases={cases}
      />
    </div>
  );
}
