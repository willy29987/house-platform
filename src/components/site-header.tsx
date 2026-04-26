import Link from "next/link";
import { HeaderSearch } from "@/components/header-search";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0b2545]/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="不動產實踐家" className="group flex shrink-0 items-center gap-3">
          <BrandLogo className="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#1e3a8a] sm:text-[11px] sm:tracking-[0.35em]">
              Realty Practitioner
            </span>
            <span className="mt-1 text-[18px] font-extrabold tracking-wider text-[#0b2545] sm:text-[22px] md:text-[24px]">
              不動產實踐家
            </span>
          </div>
        </Link>

        <HeaderSearch />
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
