import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerTrackingNewForm } from "@/components/owner-tracking-new-form";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  appendOwnerTrackingListContext,
  ownerTrackingListHrefFromListParam,
} from "@/lib/owner-tracking-list-url";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asText(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOwnerTrackingEditPage({ params, searchParams }: PageProps) {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const { id } = await params;
  const listParam = asText((await searchParams).list);
  const returnListHref = ownerTrackingListHrefFromListParam(listParam);
  const detailHref = appendOwnerTrackingListContext(`/admin/owner-tracking/${id}`, listParam ?? "");

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <Link href={detailHref} className="text-sm font-medium text-[#1e3a8a] hover:underline">
          ← 回案件詳情
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">修改案件</h1>
        <p className="mt-1 text-xs text-zinc-500">更新物件與屋主資料；追蹤紀錄不會被刪除。</p>
      </div>
      <OwnerTrackingNewForm
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
        mode="edit"
        caseId={id}
        returnListHref={returnListHref}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
