import Link from "next/link";
import { redirect } from "next/navigation";
import { CommissionManager } from "@/components/commission-manager";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminCommissionsPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-600">業績統計</p>
          <h1 className="text-2xl font-bold text-zinc-900">服務費統計</h1>
          <p className="mt-1 text-xs text-zinc-500">
            記錄每筆成交收取的服務費（佣金），依年度、月份統計總額與已收 / 未收。
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ← 回後台
        </Link>
      </div>

      <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800 ring-1 ring-blue-200">
        服務費紀錄已同步至雲端（Supabase），本機、Vercel 正式站與同事後台會共用同一份資料。首次使用時，若本機瀏覽器裡已有舊資料，請在本機登入後台開啟此頁，系統會自動上傳一次。
      </div>

      <CommissionManager
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
