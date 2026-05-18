"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function goSearch() {
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    setOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    goSearch();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="搜尋"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-white transition hover:bg-[#1e3a8a] sm:h-10 sm:w-10"
      >
        <svg className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            aria-label="關閉搜尋"
            onClick={() => setOpen(false)}
          />
          <form
            id={panelId}
            role="search"
            onSubmit={onSubmit}
            className="absolute right-0 top-full z-50 mt-2 flex w-[min(calc(100vw-1.5rem),18rem)] items-center gap-1.5 rounded-full border border-zinc-200 bg-white p-1 pl-3 shadow-lg sm:w-72"
          >
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="地區、社區、關鍵字…"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[#0b2545] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1e3a8a]"
            >
              搜尋
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
