/** 切到客服時立刻顯示骨架，不等伺服器把對話整包算完 */
export default function LineAssistantLoading() {
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] w-full flex-col overflow-hidden sm:h-[calc(100dvh-8.5rem)] sm:max-h-[calc(100dvh-8.5rem)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#d8dde6] bg-[#f5f6f8]">
        <div className="flex shrink-0 gap-2 border-b border-[#d8dde6] bg-white px-3 py-2">
          <div className="h-7 w-16 animate-pulse rounded-full bg-zinc-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-zinc-200" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-zinc-200" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(16rem,20%)_minmax(0,1fr)_minmax(18rem,22%)]">
          <ul className="min-h-0 space-y-0 overflow-hidden border-r border-[#d8dde6] bg-white">
            {Array.from({ length: 8 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3 border-b border-zinc-100 px-3 py-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-3 w-40 max-w-full animate-pulse rounded bg-zinc-100" />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden items-center justify-center bg-[#7494c0]/40 text-sm text-zinc-600 lg:flex">
            載入客服…
          </div>
          <div className="hidden bg-white lg:block" />
        </div>
        <p className="px-4 py-6 text-center text-sm text-zinc-500 lg:hidden">載入客服…</p>
      </div>
    </div>
  );
}
