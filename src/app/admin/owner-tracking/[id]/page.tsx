import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwnerTrackingDetail } from "@/components/owner-tracking-detail";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ownerTrackingListHrefFromListParam } from "@/lib/owner-tracking-list-url";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOwnerTrackingDetailPage({ params, searchParams }: PageProps) {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const { id } = await params;
  const listParam = asText((await searchParams).list);
  const listHref = ownerTrackingListHrefFromListParam(listParam);

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="mb-4 hidden sm:block">
        <Link href={listHref} className="text-sm font-medium text-[#1e3a8a] hover:underline">
          ← 回屋主追蹤列表
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">載入案件…</p>}>
        <OwnerTrackingDetail
          caseId={id}
          currentUsername={current.username}
          isSuperAdmin={current.role === "SUPER_ADMIN"}
        />
      </Suspense>
    </main>
  );
}

export const dynamic = "force-dynamic";
