import { AdminShell } from "@/components/admin-shell";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentAdmin();
  const shellUser = current
    ? { username: current.username, role: current.role }
    : null;

  return <AdminShell current={shellUser}>{children}</AdminShell>;
}
