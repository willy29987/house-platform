import { redirect } from "next/navigation";
import { LineAssistantWorkbench } from "@/components/line-assistant-workbench";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function lineBasicIdFromEnv() {
  const addFriendUrl =
    process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || process.env.NEXT_PUBLIC_LINE_OA_URL || "";
  return addFriendUrl.match(/@[\w.-]+/)?.[0] ?? "";
}

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current || current.role !== "SUPER_ADMIN") redirect("/admin");

  // 開頁只做登入檢查；對話／預約／物件改由客服畫面背景載入，目標 0.2 秒內先看到介面。
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] w-full flex-col overflow-hidden sm:h-[calc(100dvh-8.5rem)] sm:max-h-[calc(100dvh-8.5rem)]">
      <div className="min-h-0 flex-1 overflow-hidden">
        <LineAssistantWorkbench
          listings={[]}
          lineBasicId={lineBasicIdFromEnv()}
          staffDisplayName={current.displayName?.trim() || current.username}
        />
      </div>
    </div>
  );
}
