"use client";

import { useState } from "react";

export function DownloadExcelButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/listings/export-excel");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "下載失敗");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `listings-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下載失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-[#107c41] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c5f33] disabled:opacity-60"
      >
        <ExcelIcon />
        {loading ? "產生中..." : "下載 Excel"}
      </button>
      {error ? <span className="max-w-md text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}

function ExcelIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 6V3.5L18.5 9H14a1 1 0 0 1-1-1zM8.5 12h1.8l1.2 2 1.2-2h1.8l-2.1 3.3L14.6 19h-1.9l-1.2-2.2L10.3 19H8.4l2.3-3.6L8.5 12z" />
    </svg>
  );
}
