import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerTrackingNewForm } from "@/components/owner-tracking-new-form";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminOwnerTrackingNewPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <Link
          href="/admin/owner-tracking"
          className="text-sm font-medium text-[#1e3a8a] hover:underline"
        >
          ← 回屋主追蹤列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">新增追蹤案件</h1>
        <p className="mt-1 text-xs text-zinc-500">建立後可進入案件頁，持續追加追蹤紀錄。</p>
      </div>
      <OwnerTrackingNewForm
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
