import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "找房助理 | LINE LIFF",
  description: "LINE 內建找房問卷",
  robots: { index: false, follow: false },
};

/** LIFF 殼要極速出現：避免多餘外層，先給可見底色 */
export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900">
      {/* 首屏保底：JS 還沒來也看得到找房頁在載 */}
      <noscript>
        <p className="p-6 text-center text-sm">請在 LINE 內開啟找房頁面。</p>
      </noscript>
      {children}
    </div>
  );
}
