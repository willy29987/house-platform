import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { getCurrentAdmin } from "@/lib/admin-auth";

async function getUsers() {
  if (!process.env.DATABASE_URL) return [];
  const { prisma } = await import("@/lib/prisma");
  try {
    return await prisma.adminUser.findMany({
      select: { id: true, username: true, displayName: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    const users = await prisma.adminUser.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({ ...u, displayName: null }));
  }
}

export default async function AdminSettingsPage() {
  const current = await getCurrentAdmin();
  if (!current || current.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const users = await getUsers();
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  const serializedUsers = users.map((u) => ({
    ...u,
    role: u.role as "SUPER_ADMIN" | "OPERATOR",
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600">內部管理後台</p>
          <h1 className="text-2xl font-bold text-zinc-900">帳號管理</h1>
          <p className="mt-1 text-xs text-zinc-500">
            目前登入：<span className="font-medium text-zinc-700">{current.username}</span>
            <span className="ml-2 rounded-full bg-[#0b2545] px-2 py-0.5 text-white">最高管理員</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GoPublicSiteButton />
          <Link href="/admin" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            回總覽
          </Link>
          <AdminLogoutButton />
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <AdminUsersManager initialUsers={serializedUsers} hasDatabase={hasDatabase} />
      </section>
    </main>
  );
}
