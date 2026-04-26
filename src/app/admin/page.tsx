import Link from "next/link";
import { getAdminListings, getAdminStats, getInquiries } from "@/lib/listings";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AdminListingTable } from "@/components/admin-listing-table";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { getCurrentAdmin } from "@/lib/admin-auth";

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminPage() {
  const [listings, current, stats, inquiries] = await Promise.all([
    getAdminListings(),
    getCurrentAdmin(),
    getAdminStats(),
    getInquiries(),
  ]);
  const isSuperAdmin = current?.role === "SUPER_ADMIN";
  const pendingInquiries = inquiries.filter((i) => !i.isHandled).slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">內部管理後台</p>
          <h1 className="text-2xl font-bold text-zinc-900">營運總覽</h1>
          {current ? (
            <p className="mt-1 text-xs text-zinc-500">
              登入：<span className="font-medium text-zinc-700">{current.username}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-white ${isSuperAdmin ? "bg-[#0b2545]" : "bg-zinc-500"}`}>
                {isSuperAdmin ? "最高管理員" : "物件操作員"}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/listings/new"
            className="rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e3a8a]"
          >
            新增廣告
          </Link>
          <Link
            href="/admin/listings/records"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            資料總紀錄
          </Link>
          <Link
            href="/admin/team"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            AI 團隊
          </Link>
          {isSuperAdmin ? (
            <Link
              href="/admin/settings"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              帳號管理
            </Link>
          ) : null}
          <GoPublicSiteButton />
          <AdminLogoutButton />
        </div>
      </div>

      {/* 營運小卡片 */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="出租物件"
          value={stats.rentPublished}
          hint={`共 ${stats.totalListings} 筆`}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="買賣物件"
          value={stats.salePublished}
          hint={`未刊登 ${stats.unpublished} 筆`}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="未處理詢問"
          value={stats.unhandledInquiries}
          hint={`累積 ${stats.totalInquiries} 筆`}
          accent="bg-rose-50 text-rose-700"
          highlight={stats.unhandledInquiries > 0}
        />
        <StatCard
          label="本週新增"
          value={stats.weekNewListings}
          hint={`今日 ${stats.todayNewListings} 物件 · ${stats.todayInquiries} 詢問`}
          accent="bg-amber-50 text-amber-700"
        />
      </section>

      {/* 未處理詢問預覽 */}
      {pendingInquiries.length > 0 ? (
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <span className="inline-block h-5 w-1 rounded-full bg-rose-500" />
              待處理詢問
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {stats.unhandledInquiries}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {pendingInquiries.map((inq) => (
              <div key={inq.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="w-32 shrink-0 text-zinc-500">{formatDateTime(new Date(inq.createdAt))}</span>
                <span className="font-semibold text-zinc-900">{inq.name}</span>
                <a href={`tel:${inq.phone}`} className="text-[#2563eb] hover:underline">
                  {inq.phone}
                </a>
                <span className="text-zinc-600">→</span>
                <Link
                  href={`/listings/${inq.listingId}`}
                  className="text-zinc-700 hover:underline"
                >
                  {inq.listingTitle}
                </Link>
                {inq.message ? (
                  <span className="w-full truncate text-xs text-zinc-500 sm:w-auto sm:flex-1">
                    「{inq.message}」
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">房源管理</h2>
        <AdminListingTable listings={listings} />
      </section>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  hint?: string;
  accent: string;
  highlight?: boolean;
};

function StatCard({ label, value, hint, accent, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${
        highlight ? "ring-rose-200" : "ring-zinc-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600">{label}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accent}`}>#</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
