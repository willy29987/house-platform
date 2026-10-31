import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "找房助理 | LINE LIFF",
  description: "LINE 內建找房問卷",
  robots: { index: false, follow: false },
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-zinc-100">{children}</div>;
}
