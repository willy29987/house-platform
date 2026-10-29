import Link from "next/link";
import { getAdminListings, getAdminStats, getInquiries } from "@/lib/listings";
import { AdminListingTable } from "@/components/admin-listing-table";
import { AdminUpcomingRelease } from "@/components/admin-upcoming-release";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { formatAdminStaffLabel, loadAdminStaffLabelMap } from "@/lib/admin-staff-labels";

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type AdminPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { type } = await searchParams;
  const activeType = type === "sale" ? "SALE" : "RENT";
  const [listings, current, stats, inquiries, staffLabels] = await Promise.all([
    getAdminListings(),
    getCurrentAdmin(),
    getAdminStats(),
    getInquiries(),
    loadAdminStaffLabelMap(),
  ]);
  const isSuperAdmin = current?.role === "SUPER_ADMIN";
  const pendingInquiries = inquiries.filter((i) => !i.isHandled).slice(0, 5);
  const currentLabel = current
    ? formatAdminStaffLabel(current.username, {
        ...staffLabels,
        [current.username]: (current.displayName ?? "").trim() || staffLabels[current.username] || "",
      })
    : "";

  const tableProps = {
    listings,
    listingType: activeType as "RENT" | "SALE",
    currentUsername: current?.username ?? "",
    isSuperAdmin: Boolean(isSuperAdmin),
    staffLabels,
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* —— 手機版首頁 —— */}
      <div className="space-y-5 md:hidden">
        {current ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            <span className="font-semibold text-zinc-900" title={current.username}>
              {currentLabel}
            </span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                isSuperAdmin ? "bg-[#0b2545]" : "bg-zinc-500"
              }`}
            >
              {isSuperAdmin ? "最高管理員" : "業務"}
            </span>
          </p>
        ) : null}

        <section className="grid grid-cols-2 gap-2.5">
          <MobileStatCard
            label="出租物件"
            value={stats.rentPublished}
            hint={`共 ${stats.totalListings} 筆`}
            href="/admin?type=rent"
          />
          <MobileStatCard
            label="買賣物件"
            value={stats.salePublished}
            hint={`未刊登 ${stats.unpublished} 筆`}
            href="/admin?type=sale"
          />
        </section>

        <div className="inline-flex w-full overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          <Link
            href="/admin?type=rent"
            className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
              activeType === "RENT" ? "bg-[#0b2545] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            租賃
          </Link>
          <Link
            href="/admin?type=sale"
            className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
              activeType === "SALE" ? "bg-[#0b2545] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            買賣
          </Link>
        </div>

        <AdminUpcomingRelease
          listings={listings}
          currentUsername={current?.username ?? ""}
          isSuperAdmin={Boolean(isSuperAdmin)}
        />

        {isSuperAdmin && pendingInquiries.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-900">
              <span className="inline-block h-5 w-1 rounded-full bg-rose-500" />
              待處理詢問
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {stats.unhandledInquiries}
              </span>
            </h2>
            <div className="space-y-3">
              {pendingInquiries.map((inq) => (
                <div key={inq.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                  <p className="text-xs text-zinc-500">{formatDateTime(new Date(inq.createdAt))}</p>
                  <p className="mt-1 font-semibold text-zinc-900">
                    {inq.name}
                    <a href={`tel:${inq.phone}`} className="ml-2 font-medium text-[#2563eb]">
                      {inq.phone}
                    </a>
                  </p>
                  <Link href={`/listings/${inq.listingId}`} className="mt-1 block text-zinc-700 underline-offset-2 hover:underline">
                    {inq.listingTitle}
                  </Link>
                  {inq.message ? <p className="mt-1 text-xs text-zinc-500">「{inq.message}」</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <AdminListingTable {...tableProps} showMobileSectionTitle />
        </section>
      </div>

      {/* —— 電腦版首頁（上一版版型） —— */}
      <div className="hidden space-y-6 md:block">
        {current ? (
          <p className="text-sm text-zinc-600">
            登入：
            <span className="font-medium text-zinc-900" title={current.username}>
              {currentLabel}
            </span>
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
                isSuperAdmin ? "bg-[#0b2545]" : "bg-zinc-500"
              }`}
            >
              {isSuperAdmin ? "最高管理員" : "物件操作員"}
            </span>
          </p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <DesktopStatCard
            label="出租物件"
            value={stats.rentPublished}
            hint={`共 ${stats.totalListings} 筆`}
            accent="bg-blue-50 text-blue-700"
          />
          <DesktopStatCard
            label="買賣物件"
            value={stats.salePublished}
            hint={`未刊登 ${stats.unpublished} 筆`}
            accent="bg-emerald-50 text-emerald-700"
          />
          <DesktopStatCard
            label="本週新增"
            value={stats.weekNewListings}
            hint={`今日 ${stats.todayNewListings} 物件 · ${stats.todayInquiries} 詢問`}
            accent="bg-amber-50 text-amber-700"
          />
        </section>

        <AdminUpcomingRelease
          listings={listings}
          currentUsername={current?.username ?? ""}
          isSuperAdmin={Boolean(isSuperAdmin)}
        />

        {pendingInquiries.length > 0 ? (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <span className="inline-block h-5 w-1 rounded-full bg-rose-500" />
              待處理詢問
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                {stats.unhandledInquiries}
              </span>
            </h2>
            <div className="divide-y divide-zinc-100">
              {pendingInquiries.map((inq) => (
                <div key={inq.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="w-32 shrink-0 text-zinc-500">{formatDateTime(new Date(inq.createdAt))}</span>
                  <span className="font-semibold text-zinc-900">{inq.name}</span>
                  <a href={`tel:${inq.phone}`} className="text-[#2563eb] hover:underline">
                    {inq.phone}
                  </a>
                  <span className="text-zinc-600">→</span>
                  <Link href={`/listings/${inq.listingId}`} className="text-zinc-700 hover:underline">
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">房源管理</h2>
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white p-0.5">
              <Link
                href="/admin?type=rent"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  activeType === "RENT" ? "bg-[#0b2545] text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                租賃
              </Link>
              <Link
                href="/admin?type=sale"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  activeType === "SALE" ? "bg-[#0b2545] text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                買賣
              </Link>
            </div>
          </div>
          <AdminListingTable {...tableProps} />
        </section>
      </div>
    </div>
  );
}

type MobileStatCardProps = {
  label: string;
  value: number;
  hint?: string;
  href: string;
};

function MobileStatCard({ label, value, hint, href }: MobileStatCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center rounded-xl bg-white px-3 py-2.5 text-center shadow-sm ring-1 ring-zinc-200 transition active:scale-[0.98]"
    >
      <p className="text-xs font-semibold text-zinc-800">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-[10px] leading-tight text-zinc-500">{hint}</p> : null}
    </Link>
  );
}

type DesktopStatCardProps = {
  label: string;
  value: number;
  hint?: string;
  accent: string;
  highlight?: boolean;
};

function DesktopStatCard({ label, value, hint, accent, highlight }: DesktopStatCardProps) {
  return (
    <div
      className={`rounded-xl bg-white p-3.5 shadow-sm ring-1 ${
        highlight ? "ring-rose-200" : "ring-zinc-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600">{label}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${accent}`}>#</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
