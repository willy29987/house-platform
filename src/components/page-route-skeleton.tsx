/** 輕量路由 skeleton：loading.tsx 用，讓切頁在等待 RSC 時立刻有畫面 */
export function PageRouteSkeleton({ label = "載入中…" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] animate-pulse px-3 py-4 sm:px-4 sm:py-6 lg:px-6" aria-busy="true" aria-label={label}>
      <div className="mb-4 h-7 w-40 rounded-lg bg-zinc-200/80" />
      <div className="mb-3 h-10 w-full max-w-xl rounded-xl bg-zinc-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-2xl bg-zinc-200/60" />
        <div className="h-28 rounded-2xl bg-zinc-200/60" />
        <div className="hidden h-28 rounded-2xl bg-zinc-200/60 lg:block" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-12 rounded-xl bg-zinc-200/55" />
        <div className="h-12 rounded-xl bg-zinc-200/55" />
        <div className="h-12 rounded-xl bg-zinc-200/50" />
      </div>
    </div>
  );
}
