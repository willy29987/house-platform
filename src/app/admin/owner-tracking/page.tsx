import { redirect } from "next/navigation";
import { OwnerTrackingList } from "@/components/owner-tracking-list";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminOwnerTrackingPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  return (
    <main className="mx-auto w-full max-w-6xl">
      <OwnerTrackingList
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
