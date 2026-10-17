"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BrandLogo } from "@/components/brand-logo";

export type AdminShellUser = {
  username: string;
  role: "SUPER_ADMIN" | "OPERATOR";
} | null;

type AdminShellProps = {
  current: AdminShellUser;
  children: React.ReactNode;
};

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AdminShell({ current, children }: AdminShellProps) {
  const pathname = usePathname() ?? "";
  const isLogin = pathname.startsWith("/admin/login");
  const [menuOpen, setMenuOpen] = useState(false);
  const isSuperAdmin = current?.role === "SUPER_ADMIN";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (isLogin) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#0b2545] via-[#132f52] to-[#1e3a8a]">
        {children}
      </div>
    );
  }

  const menuLinkCls =
    "block rounded-xl px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f4f6f9]">
      <header className="sticky top-0 z-40 border-b border-[#0b2545]/10 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-3 sm:h-16 sm:px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 md:hidden"
            aria-label="開啟選單"
          >
            <MenuIcon />
          </button>
          <Link href="/admin" className="group flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <BrandLogo className="h-8 w-8 shrink-0 transition-transform group-hover:scale-105 sm:h-9 sm:w-9" />
            <span className="truncate text-base font-extrabold tracking-wide text-[#0b2545] sm:text-lg">
              不動產實踐家
            </span>
          </Link>
          {current ? (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="max-w-[6rem] truncate text-xs text-zinc-600">{current.username}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                  isSuperAdmin ? "bg-[#0b2545]" : "bg-zinc-500"
                }`}
              >
                {isSuperAdmin ? "管理員" : "業務"}
              </span>
            </div>
          ) : null}
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/admin/listings/new"
              className="rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e3a8a]"
            >
              新增廣告
            </Link>
            <Link
              href="/admin/owner-tracking"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              屋主追蹤
            </Link>
            {isSuperAdmin ? (
              <>
                <Link
                  href="/admin/listings/records"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  資料紀錄
                </Link>
                <Link
                  href="/admin/tenants"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  房客管理
                </Link>
                <Link
                  href="/admin/commissions"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  服務費統計
                </Link>
                <Link
                  href="/admin/team"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  AI 團隊
                </Link>
              </>
            ) : null}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              外網
            </Link>
            {isSuperAdmin ? (
              <Link
                href="/admin/settings"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                帳號
              </Link>
            ) : null}
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="後台選單">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="關閉選單"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
              <div>
                <p className="text-xs font-semibold text-[#1e3a8a]">多功能選單</p>
                {current ? (
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {current.username}
                    <span className="ml-1.5 text-xs text-zinc-400">
                      {isSuperAdmin ? "最高管理員" : "業務"}
                    </span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="關閉選單"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <div className="grid gap-1.5">
                <Link
                  href="/admin/listings/new"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-[#0b2545] px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm active:bg-[#1e3a8a]"
                >
                  ＋ 新增廣告
                </Link>
                <Link href="/admin" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                  營運總覽
                </Link>
                <Link href="/admin?type=rent" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                  租賃物件
                </Link>
                <Link href="/admin?type=sale" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                  買賣物件
                </Link>
                {isSuperAdmin ? (
                  <>
                    <Link
                      href="/admin/listings/records"
                      onClick={() => setMenuOpen(false)}
                      className={menuLinkCls}
                    >
                      資料總紀錄
                    </Link>
                    <Link href="/admin/tenants" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                      房客管理
                    </Link>
                    <Link href="/admin/commissions" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                      服務費統計
                    </Link>
                    <Link href="/admin/team" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                      AI 團隊
                    </Link>
                  </>
                ) : null}
                <Link
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className={menuLinkCls}
                >
                  外網
                </Link>
                {isSuperAdmin ? (
                  <Link href="/admin/settings" onClick={() => setMenuOpen(false)} className={menuLinkCls}>
                    帳號管理
                  </Link>
                ) : null}
                <div className="pt-2">
                  <AdminLogoutButton />
                </div>
              </div>
            </nav>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">{children}</main>
    </div>
  );
}
