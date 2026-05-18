import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "手機預覽 | 不動產實踐家",
  description: "以固定寬度預覽本站手機版面，供開發與調整響應式樣式用。",
  robots: { index: false, follow: false },
};

/** 全螢幕預覽殼：不與一般頁面共用 header 高度，讓手機框盡量大 */
export default function MobilePreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-zinc-900">
      {children}
    </div>
  );
}
