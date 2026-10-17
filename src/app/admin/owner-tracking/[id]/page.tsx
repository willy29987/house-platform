import Link from "next/link";
import { redirect } from "next/navigation";
import { OwnerTrackingDetail } from "@/components/owner-tracking-detail";
import { getCurrentAdmin } from "@/lib/admin-auth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOwnerTrackingDetailPage({ params }: PageProps) {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="mb-4 hidden sm:block">
        <Link
          href="/admin/owner-tracking"
          className="text-sm font-medium text-[#1e3a8a] hover:underline"
        >
          ← 回屋主追蹤列表
        </Link>
      </div>
      <OwnerTrackingDetail
        caseId={id}
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
