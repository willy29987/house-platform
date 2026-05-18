import Link from "next/link";
import { AdminListingForm, type AdminListingFormData } from "@/components/admin-listing-form";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { createEmptyFormData } from "@/lib/listing-form-defaults";

type NewListingPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function AdminNewListingPage({ searchParams }: NewListingPageProps) {
  const { type } = await searchParams;

  if (type !== "rent" && type !== "sale") {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900">新增廣告房源</h1>
          <div className="flex items-center gap-2">
            <GoPublicSiteButton />
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              回管理後台
            </Link>
          </div>
        </div>
        <p className="mb-6 text-sm text-zinc-600">請先選擇要上架的物件類型（租賃與買賣使用不同的上架表單）。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/listings/new?type=rent"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md"
          >
            <div className="mb-3 text-4xl">🏠</div>
            <h2 className="text-xl font-bold text-zinc-900">上架租賃物件</h2>
            <p className="mt-2 text-sm text-zinc-500">
              租金、管理費、車位租金、寵物/報稅/入戶籍、帶看方式…
            </p>
            <span className="mt-4 inline-block rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white group-hover:bg-blue-700">
              前往租賃表單 →
            </span>
          </Link>
          <Link
            href="/admin/listings/new?type=sale"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
          >
            <div className="mb-3 text-4xl">💰</div>
            <h2 className="text-xl font-bold text-zinc-900">上架買賣物件</h2>
            <p className="mt-2 text-sm text-zinc-500">
              售價、屋齡、朝向、裝潢、使用分區、車位是否含總價…
            </p>
            <span className="mt-4 inline-block rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white group-hover:bg-emerald-700">
              前往買賣表單 →
            </span>
          </Link>
        </div>
      </main>
    );
  }

  const initialData: AdminListingFormData = createEmptyFormData(type === "rent" ? "RENT" : "SALE");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500">
              {type === "rent" ? "RENT" : "SALE"} 新增
            </p>
            <h1 className="text-2xl font-bold text-zinc-900">
              {type === "rent" ? "新增租賃廣告" : "新增買賣廣告"}
            </h1>
          </div>
          <div className="flex gap-2">
            <GoPublicSiteButton />
            <Link
              href="/admin/listings/new"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              改選類型
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              回後台
            </Link>
          </div>
        </div>
        <AdminListingForm
          mode="create"
          submitUrl="/api/admin/listings"
          initialData={initialData}
          lockedListingType={type === "rent" ? "RENT" : "SALE"}
        />
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";
