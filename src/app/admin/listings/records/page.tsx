import Link from "next/link";
import { getAdminListingRecords } from "@/lib/listings";
import { AdminListingRecords } from "@/components/admin-listing-records";
import { GoPublicSiteButton } from "@/components/go-public-site-button";

export const dynamic = "force-dynamic";

export default async function AdminRecordsPage() {
  const records = await getAdminListingRecords();

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-600">內部管理後台</p>
          <h1 className="text-2xl font-bold text-zinc-900">物件資料總紀錄</h1>
          <p className="mt-1 text-xs text-zinc-500">
            全部物件（含未刊登）完整欄位，可搜尋、篩選、匯出 CSV
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GoPublicSiteButton />
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ← 回營運總覽
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <AdminListingRecords records={records} />
      </section>
    </main>
  );
}
