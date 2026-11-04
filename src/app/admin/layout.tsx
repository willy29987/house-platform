import { AdminShell } from "@/components/admin-shell";

/**
 * 刻意不在 layout await getCurrentAdmin：
 * layout 若讀 cookies／DB，會擋住 loading.tsx，切頁就無法在 0.2s 內換畫面。
 * 身分改由 AdminShell 非阻塞載入（快取 + /api/admin/me）。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
