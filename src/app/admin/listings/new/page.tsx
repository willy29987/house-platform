import Link from "next/link";
import { AdminNewListingClient } from "@/components/admin-new-listing-client";
import { GoPublicSiteButton } from "@/components/go-public-site-button";

type NewListingPageProps = {
  searchParams: Promise<{ type?: string; fromOwnerCase?: string }>;
};

export default async function AdminNewListingPage({ searchParams }: NewListingPageProps) {
  const { type, fromOwnerCase } = await searchParams;

  if (type !== "rent" && type !== "sale") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link
          href="/admin/listings/new?type=rent"
          className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm transition active:scale-[0.99] hover:border-blue-500 hover:shadow-md sm:py-12"
        >
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">上架租賃物件</h2>
        </Link>
        <Link
          href="/admin/listings/new?type=sale"
          className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm transition active:scale-[0.99] hover:border-emerald-500 hover:shadow-md sm:py-12"
        >
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">上架買賣物件</h2>
        </Link>
      </div>
    );
  }

  const listingType = type === "rent" ? "RENT" : "SALE";

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-6">
      <div className="mb-4 hidden flex-wrap justify-end gap-2 md:flex">
        <GoPublicSiteButton />
        <Link
          href="/admin/listings/new"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          改選類型
        </Link>
      </div>
      <AdminNewListingClient listingType={listingType} fromOwnerCaseId={fromOwnerCase} />
    </section>
  );
}

export const dynamic = "force-dynamic";
