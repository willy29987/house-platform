"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { CommissionRecord } from "@/lib/commission-stats";

export type CommissionRecordFormProps = {
  initial: CommissionRecord;
  title: string;
  saveLabel?: string;
  /** 表單主欄位上方（例：成交時租賃釋出日） */
  extraSection?: ReactNode;
  onCancel: () => void;
  onSave: (r: CommissionRecord) => void;
  onDelete?: () => void;
};

export function CommissionRecordForm({
  initial,
  title,
  saveLabel = "儲存",
  extraSection,
  onCancel,
  onSave,
  onDelete,
}: CommissionRecordFormProps) {
  const [form, setForm] = useState<CommissionRecord>(initial);
  const [rate, setRate] = useState<string>("");
  const set = <K extends keyof CommissionRecord>(key: K, value: CommissionRecord[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const field = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-600";

  function applyRate(rateStr: string) {
    setRate(rateStr);
    const r = Number(rateStr);
    if (Number.isFinite(r) && r > 0 && form.dealAmount > 0) {
      set("commission", Math.round((form.dealAmount * r) / 100));
    }
  }

  function submit() {
    if (!form.title.trim()) {
      window.alert("請填寫物件案名");
      return;
    }
    if (!form.date) {
      window.alert("請選擇日期");
      return;
    }
    onSave({ ...form, title: form.title.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-zinc-900">{title}</h3>
        {extraSection ? <div className="mt-3">{extraSection}</div> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>成交 / 收款日期（必填）</label>
            <input type="date" className={field} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>類型</label>
            <select
              className={field}
              value={form.listingType}
              onChange={(e) => set("listingType", e.target.value as CommissionRecord["listingType"])}
            >
              <option value="RENT">租賃</option>
              <option value="SALE">買賣</option>
              <option value="OTHER">其他</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>物件案名（必填）</label>
            <input
              className={field}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例：板橋文化路 3F 套房"
            />
          </div>
          <div>
            <label className={labelCls}>承辦業務</label>
            <input
              className={field}
              value={form.operator}
              onChange={(e) => set("operator", e.target.value)}
              placeholder="例：R001 / 王小明"
            />
          </div>
          <div>
            <label className={labelCls}>客戶 / 屋主</label>
            <input
              className={field}
              value={form.client}
              onChange={(e) => set("client", e.target.value)}
              placeholder="例：陳先生"
            />
          </div>
          <div>
            <label className={labelCls}>成交金額（元）</label>
            <input
              type="number"
              min="0"
              className={field}
              value={form.dealAmount || ""}
              onChange={(e) => set("dealAmount", Number(e.target.value) || 0)}
              placeholder="租金或售價"
            />
          </div>
          <div>
            <label className={labelCls}>服務費費率（%，選填可自動換算）</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className={field}
              value={rate}
              onChange={(e) => applyRate(e.target.value)}
              placeholder="例：5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>服務費 / 佣金（元）（必填）</label>
            <input
              type="number"
              min="0"
              className={field}
              value={form.commission || ""}
              onChange={(e) => set("commission", Number(e.target.value) || 0)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={form.received}
                onChange={(e) => set("received", e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              已收款
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>備註</label>
            <textarea
              className={`${field} h-16`}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="例：收屋主一個月租金、分兩期收取…"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              刪除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
