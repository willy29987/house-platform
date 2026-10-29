import { redirect } from "next/navigation";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";

type SettingsUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "SUPER_ADMIN" | "OPERATOR";
  createdAt: Date;
};

async function getUsers(): Promise<SettingsUser[]> {
  if (!process.env.DATABASE_URL) return [];
  const { prisma } = await import("@/lib/prisma");
  const adminUser = prisma.adminUser as any;
  try {
    return await adminUser.findMany({
      select: { id: true, username: true, displayName: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    try {
      const users = await adminUser.findMany({
        select: { id: true, username: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return users.map((u: { id: string; username: string; role: "SUPER_ADMIN" | "OPERATOR"; createdAt: Date }) => ({
        ...u,
        displayName: null,
      }));
    } catch (error) {
      console.error("[db] 帳號列表查詢失敗，已降級：", error instanceof Error ? error.message.trim().split("\n").pop() : error);
      return [];
    }
  }
}

export default async function AdminSettingsPage() {
  const current = await getCurrentAdmin();
  if (!current || current.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const users = await getUsers();
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  const serializedUsers = users.map((u: SettingsUser) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm text-zinc-600">內部管理後台</p>
        <h1 className="text-2xl font-bold text-zinc-900">帳號管理</h1>
        <p className="mt-1 text-xs text-zinc-500">
          目前登入：
          <span className="font-medium text-zinc-700" title={current.username}>
            {formatAdminStaffLabel(current.username, {
              [current.username]: (current.displayName ?? "").trim(),
            })}
          </span>
          <span className="ml-2 rounded-full bg-[#0b2545] px-2 py-0.5 text-white">最高管理員</span>
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <AdminUsersManager initialUsers={serializedUsers} hasDatabase={hasDatabase} />
      </section>
    </main>
  );
}
