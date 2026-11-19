import { LineConditionReplyTestClient } from "@/components/line-condition-reply-test-client";

export default function LineConditionReplyTestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">條件問句回覆預覽</h1>
        <p className="mt-1 text-sm text-zinc-500">
          不推播、不花 LINE 額度。輸入客人會講的話＋物件 ID，看系統會不會偵測、會回什麼。
        </p>
      </div>
      <LineConditionReplyTestClient />
    </div>
  );
}
