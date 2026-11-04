"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format591RentDraftPlainText,
  type Listing591RentDraftField,
} from "@/lib/listing-591-rent-draft";

type Props = {
  open: boolean;
  onClose: () => void;
  fields: Listing591RentDraftField[];
};

export function AdminListing591RentDraftPanel({ open, onClose, fields }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const plain = useMemo(() => format591RentDraftPlainText(fields), [fields]);

  useEffect(() => {
    if (!open) setCopiedId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const map = new Map<string, Listing591RentDraftField[]>();
    for (const f of fields) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()];
  }, [fields]);

  if (!open) return null;

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      window.alert("複製失敗，請改用手動選取文字");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="591 租賃刊登草稿"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-zinc-900">591 租賃刊登草稿</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              591 租賃沒有一鍵複製。請逐欄複製貼到 591 後台，或複製全部後對照填寫。上架後記得把 591
              網址填回本表單。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            關閉
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              目前沒有可複製的欄位，請先填寫物件資料。
            </p>
          ) : (
            groups.map(([group, rows]) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {group}
                </h3>
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-zinc-500">{row.label}</p>
                        <button
                          type="button"
                          onClick={() => void copyText(row.id, row.value)}
                          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                        >
                          {copiedId === row.id ? "已複製" : "複製"}
                        </button>
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-zinc-900">
                        {row.value}
                      </pre>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">全部文字</h3>
            <textarea
              readOnly
              value={plain}
              rows={10}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800"
            />
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            onClick={() => void copyText("__all__", plain)}
            className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
          >
            {copiedId === "__all__" ? "已複製全部 ✓" : "複製全部"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
