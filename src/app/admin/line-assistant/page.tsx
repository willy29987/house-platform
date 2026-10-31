import { ListingType } from "@prisma/client";
import { redirect } from "next/navigation";
import { LineAssistantWorkbench } from "@/components/line-assistant-workbench";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getLineAccountLink } from "@/lib/line-official-account";
import { toRentalMatchListing } from "@/lib/line-rental-assistant";
import { getListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function LineAssistantPreviewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [listings, lineAccount] = await Promise.all([
    getListings({ listingType: ListingType.RENT }),
    getLineAccountLink(),
  ]);
  const cards = listings.map(toRentalMatchListing);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">租屋配對客服</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {lineAccount.basicId || "官方帳號"}
            {" · "}
            收件匣同步客人 LIFF 約看；在此回覆先供內部作業
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
      <LineAssistantWorkbench listings={cards} lineBasicId={lineAccount.basicId} />
    </div>
  );
}
