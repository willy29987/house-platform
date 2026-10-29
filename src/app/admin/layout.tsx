import { AdminShell } from "@/components/admin-shell";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentAdmin();
  const shellUser = current
    ? {
        username: current.username,
        displayName: current.displayName ?? null,
        role: current.role,
      }
    : null;

  return <AdminShell current={shellUser}>{children}</AdminShell>;
}
