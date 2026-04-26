"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      router.push("/search");
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2" role="search">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋地區、社區、關鍵字..."
          className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#1e3a8a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-full bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e3a8a]"
      >
        搜尋
      </button>
    </form>
  );
}
