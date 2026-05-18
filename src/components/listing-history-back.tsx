"use client";

export function ListingHistoryBack() {
  return (
    <button
      type="button"
      onClick={() => {
        window.history.back();
      }}
      className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
    >
      ← 返回房源列表
    </button>
  );
}
