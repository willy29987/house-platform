import { redirect } from "next/navigation";
import { LineAssistantWorkbench } from "@/components/line-assistant-workbench";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { patchLineConversationProfiles, readLineConversations } from "@/lib/line-conversations";
import { getLineUserProfile } from "@/lib/line-messaging";
import { listOpenGuestSessions } from "@/lib/line-guest-sessions";
import { listGuestProfileUserIds } from "@/lib/line-guest-profile";
import { listActiveGuestWatches } from "@/lib/line-guest-watch";
import { getLineAccountLink } from "@/lib/line-official-account";
import { loadRentalMatchListings } from "@/lib/line-rental-assistant";
import { readLineRentalCases } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";

/** 舊對話還沒存頭像時，進客服頁補抓 LINE profile（有圖才顯示） */
async function attachMissingGuestAvatars<T extends { lineUserId: string; pictureUrl?: string; displayName: string }>(
  conversations: T[],
): Promise<T[]> {
  const missing = conversations.filter((row) => typeof row.pictureUrl !== "string").slice(0, 20);
  if (missing.length === 0) return conversations;

  const settled = await Promise.all(
    missing.map(async (row) => {
      const profile = await getLineUserProfile(row.lineUserId);
      if (!profile) return null;
      return {
        lineUserId: row.lineUserId,
        displayName: profile.displayName || undefined,
        pictureUrl: profile.pictureUrl,
      };
    }),
  );
  const patches = settled.filter((row) => row !== null);

  if (patches.length === 0) return conversations;
  try {
    await patchLineConversationProfiles(patches);
  } catch (error) {
    console.warn("[line-assistant] avatar backfill failed", error);
  }

  const byId = new Map(patches.map((row) => [row.lineUserId, row]));
  return conversations.map((row) => {
    const patch = byId.get(row.lineUserId);
    if (!patch) return row;
    return {
      ...row,
      displayName: patch.displayName || row.displayName,
      pictureUrl: patch.pictureUrl,
    };
  });
}

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [cards, lineAccount, rawConversations, cases, sessions, watches, profileUserIds] =
    await Promise.all([
      loadRentalMatchListings(60),
      getLineAccountLink(),
      readLineConversations(),
      readLineRentalCases(),
      listOpenGuestSessions(),
      listActiveGuestWatches(),
      listGuestProfileUserIds(),
    ]);
  const conversations = await attachMissingGuestAvatars(rawConversations);

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
          initialWatches={watches}
          initialProfileUserIds={profileUserIds}
        />
      </div>
    </div>
  );
}
