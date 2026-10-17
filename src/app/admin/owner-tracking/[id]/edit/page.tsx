import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerTrackingNewForm } from "@/components/owner-tracking-new-form";
import { getCurrentAdmin } from "@/lib/admin-auth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOwnerTrackingEditPage({ params }: PageProps) {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <Link
          href={`/admin/owner-tracking/${id}`}
          className="text-sm font-medium text-[#1e3a8a] hover:underline"
        >
          ← 回案件詳情
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">修改案件</h1>
        <p className="mt-1 text-xs text-zinc-500">更新物件與屋主資料；追蹤紀錄不會被刪除。</p>
      </div>
      <OwnerTrackingNewForm currentUsername={current.username} mode="edit" caseId={id} />
    </main>
  );
}

export const dynamic = "force-dynamic";
