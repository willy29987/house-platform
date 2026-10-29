import { redirect } from "next/navigation";
import { OwnerTrackingList } from "@/components/owner-tracking-list";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function listStaffUsernamesForAssigneeFilter(): Promise<string[]> {
  try {
    const rows = await prisma.adminUser.findMany({
      select: { username: true },
      orderBy: { username: "asc" },
    });
    return rows.map((r) => r.username);
  } catch {
    return [];
  }
}

export default async function AdminOwnerTrackingPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const staffUsernames = await listStaffUsernamesForAssigneeFilter();

  return (
    <main className="mx-auto w-full">
      <OwnerTrackingList
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
        staffUsernames={staffUsernames}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
