import Link from "next/link";
import { Suspense } from "react";
import { HeaderSearch } from "@/components/header-search";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0b2545]/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 pl-2 pr-3 sm:h-20 sm:gap-4 sm:px-6 sm:pl-6 sm:pr-6">
        <Link href="/" aria-label="不動產實踐家" className="group flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <BrandLogo className="h-8 w-8 shrink-0 transition-transform duration-300 group-hover:scale-105 sm:h-9 sm:w-9 md:h-10 md:w-10" />
          <div className="min-w-0 flex flex-col gap-2 leading-none sm:gap-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#1e3a8a] sm:text-[11px] sm:tracking-[0.35em]">
              Realty Practitioner
            </span>
            <span className="truncate text-[15px] font-extrabold tracking-wide text-[#0b2545] sm:text-[22px] sm:tracking-wider md:text-[24px]">
              不動產實踐家
            </span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/#services"
            className="hidden shrink-0 rounded-full border border-[#0b2545]/15 px-4 py-2 text-sm font-semibold text-[#0b2545] transition hover:bg-[#0b2545] hover:text-white md:inline-flex"
          >
            服務項目
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/favorites"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0b2545]/15 text-[#0b2545] transition hover:bg-[#0b2545]/5 sm:h-10 sm:w-10"
              aria-label="我的收藏"
              title="我的收藏"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path
                  strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </Link>
            <Suspense fallback={<div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />}>
              <HeaderSearch />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}

function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoNavy" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
        <linearGradient id="logoGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4d58a" />
          <stop offset="100%" stopColor="#c9a24b" />
        </linearGradient>
      </defs>

      <path
        d="M28 3 L53 28 L28 53 L3 28 Z"
        fill="none"
        stroke="url(#logoNavy)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      <path
        d="M16 30 L28 18 L40 30 V42 H33 V33 H23 V42 H16 Z"
        fill="url(#logoNavy)"
      />

      <path
        d="M28 11 L33 17 H23 Z"
        fill="url(#logoGold)"
      />

      <rect x="25.5" y="35" width="5" height="7" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}
