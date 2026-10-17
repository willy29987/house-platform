import Link from "next/link";
import { redirect } from "next/navigation";
import { TenantManager } from "@/components/tenant-manager";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminTenantsPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-600">自有出租管理</p>
          <h1 className="text-2xl font-bold text-zinc-900">房客管理</h1>
          <p className="mt-1 text-xs text-zinc-500">
            管理自家出租物件的房客、租金催繳與水電瓦斯費用計算。
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
        這是第一版示範：資料暫存於此瀏覽器（localStorage），換裝置或清除快取會看不到。確認流程後可再升級為雲端資料庫，供多人多裝置共用。
      </div>

      <TenantManager />
    </main>
  );
}

export const dynamic = "force-dynamic";
