"use client";

import { useEffect, useMemo, useState } from "react";
import { CommissionRecordForm } from "@/components/commission-record-form";
import {
  commissionTypeBadgeCls,
  commissionTypeLabel,
  emptyCommissionRecord,
  formatCommissionNtd,
  loadCommissionRecordsLocal,
  persistCommissionRecordsLocal,
  saveCommissionRecords,
  type CommissionRecord,
} from "@/lib/commission-stats";
import { hydrateCommissionRecordsOnce } from "@/lib/admin-cloud-sync-client";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";

function currentYear(): number {
  return new Date().getFullYear();
}

type CommissionManagerProps = {
  currentUsername: string;
  staffLabels?: Record<string, string>;
  isSuperAdmin?: boolean;
};

export function CommissionManager({
  currentUsername,
  staffLabels = {},
  isSuperAdmin = false,
}: CommissionManagerProps) {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [year, setYear] = useState<number>(currentYear());
  const [editing, setEditing] = useState<CommissionRecord | null>(null);

  useEffect(() => {
    void hydrateCommissionRecordsOnce(loadCommissionRecordsLocal, persistCommissionRecordsLocal)
      .then((next) => {
        setRecords(next);
        setCloudSynced(true);
        setHydrated(true);
      })
      .catch(() => {
        setRecords(loadCommissionRecordsLocal());
        setCloudSynced(true);
        setHydrated(true);
      });
  }, []);

  const visibleRecords = useMemo(() => {
    if (isSuperAdmin) return records;
    return records.filter((r) => (r.operator?.trim() || "") === currentUsername);
  }, [records, isSuperAdmin, currentUsername]);

  useEffect(() => {
    if (!hydrated || !cloudSynced) return;
    saveCommissionRecords(records);
  }, [records, hydrated, cloudSynced]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear()]);
    for (const r of visibleRecords) {
      const y = Number(r.date.slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [visibleRecords]);

  const yearRecords = useMemo(
    () =>
      visibleRecords
        .filter((r) => Number(r.date.slice(0, 4)) === year)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [visibleRecords, year],
  );

  const summary = useMemo(() => {
    let total = 0;
    let received = 0;
    for (const r of yearRecords) {
      total += r.commission;
      if (r.received) received += r.commission;
    }
    return { total, received, unpaid: total - received, count: yearRecords.length };
  }, [yearRecords]);

  /** 依月份分組（含小計），月份新→舊 */
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, CommissionRecord[]>();
    for (const r of yearRecords) {
      const m = r.date.slice(0, 7);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, list]) => ({
        month,
        list,
        subtotal: list.reduce((s, r) => s + r.commission, 0),
      }));
  }, [yearRecords]);

  function saveRecord(r: CommissionRecord) {
    setRecords((rs) => {
      const exists = rs.some((x) => x.id === r.id);
      return exists ? rs.map((x) => (x.id === r.id ? r : x)) : [...rs, r];
    });
    const y = Number(r.date.slice(0, 4));
    if (Number.isFinite(y)) setYear(y);
    setEditing(null);
  }

  function removeRecord(id: string) {
    if (!window.confirm("確定刪除此筆服務費紀錄？")) return;
    setRecords((rs) => rs.filter((x) => x.id !== id));
  }

  function toggleReceived(id: string) {
    setRecords((rs) => rs.map((x) => (x.id === id ? { ...x, received: !x.received } : x)));
  }

  if (!hydrated) {
    return <p className="rounded-2xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">載入中…</p>;
  }

  return (
    <div className="space-y-4">
      {!isSuperAdmin ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          目前僅顯示承辦業務為「{formatAdminStaffLabel(currentUsername, staffLabels)}」的紀錄。
        </p>
      ) : null}
      {/* 年度切換 + 新增 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            >
              ‹
            </button>
            <span className="min-w-[5rem] text-center text-base font-bold text-zinc-900">{year} 年</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            >
              ›
            </button>
            {years.length > 1 ? (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="ml-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              setEditing({
                ...emptyCommissionRecord(),
                operator: isSuperAdmin ? "" : currentUsername,
              })
            }
            className="rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
          >
            ＋ 新增服務費紀錄
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatBox label={`${year} 年服務費總額`} value={formatCommissionNtd(summary.total)} accent="text-[#0b2545]" />
          <StatBox label="已收" value={formatCommissionNtd(summary.received)} accent="text-emerald-700" />
          <StatBox label="未收" value={formatCommissionNtd(summary.unpaid)} accent="text-rose-700" />
          <StatBox label="成交筆數" value={`${summary.count} 筆`} accent="text-zinc-900" />
        </div>
      </section>

      {/* 統計表 */}
      {yearRecords.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200">
          <p className="text-3xl">💰</p>
          <p className="mt-2 text-sm text-zinc-600">
            {year} 年尚無服務費紀錄，點「新增服務費紀錄」開始建立。
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#0b2545] text-left text-xs font-semibold text-white">
                  <th className="px-3 py-2.5">日期</th>
                  <th className="px-3 py-2.5">物件案名</th>
                  <th className="px-3 py-2.5">類型</th>
                  <th className="px-3 py-2.5">業務</th>
                  <th className="px-3 py-2.5">客戶 / 屋主</th>
                  <th className="px-3 py-2.5 text-right">成交金額</th>
                  <th className="px-3 py-2.5 text-right">服務費</th>
                  <th className="px-3 py-2.5 text-center">狀態</th>
                  <th className="px-3 py-2.5 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {monthlyGroups.map((g) => (
                  <MonthGroup
                    key={g.month}
                    month={g.month}
                    list={g.list}
                    subtotal={g.subtotal}
                    staffLabels={staffLabels}
                    onToggle={toggleReceived}
                    onEdit={setEditing}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0b2545] bg-[#0b2545]/5 font-bold text-[#0b2545]">
                  <td className="px-3 py-2.5" colSpan={6}>
                    {year} 年合計
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatCommissionNtd(summary.total)}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-medium text-emerald-700">
                    已收 {formatCommissionNtd(summary.received)}
                  </td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {editing ? (
        <CommissionRecordForm
          initial={editing}
          title={editing.title ? "編輯服務費紀錄" : "新增服務費紀錄"}
          onCancel={() => setEditing(null)}
          onSave={saveRecord}
          onDelete={records.some((x) => x.id === editing.id) ? () => removeRecord(editing.id) : undefined}
        />
      ) : null}
    </div>
  );
}

function MonthGroup({
  month,
  list,
  subtotal,
  staffLabels = {},
  onToggle,
  onEdit,
}: {
  month: string;
  list: CommissionRecord[];
  subtotal: number;
  staffLabels?: Record<string, string>;
  onToggle: (id: string) => void;
  onEdit: (r: CommissionRecord) => void;
}) {
  const m = Number(month.slice(5, 7));
  return (
    <>
      <tr className="bg-zinc-100/80">
        <td className="px-3 py-1.5 text-xs font-bold text-zinc-600" colSpan={6}>
          {m} 月（{list.length} 筆）
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-bold text-zinc-700">{formatCommissionNtd(subtotal)}</td>
        <td className="px-3 py-1.5" colSpan={2} />
      </tr>
      {list.map((r) => (
        <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
          <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{r.date}</td>
          <td className="px-3 py-2.5 font-medium text-zinc-900">{r.title || "（未命名）"}</td>
          <td className="px-3 py-2.5">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${commissionTypeBadgeCls[r.listingType]}`}>
              {commissionTypeLabel[r.listingType]}
            </span>
          </td>
          <td
            className="whitespace-nowrap px-3 py-2.5 text-zinc-700"
            title={r.operator || undefined}
          >
            {formatAdminStaffLabel(r.operator, staffLabels)}
          </td>
          <td className="whitespace-nowrap px-3 py-2.5 text-zinc-700">{r.client || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2.5 text-right text-zinc-700">
            {r.dealAmount ? formatCommissionNtd(r.dealAmount) : "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-[#0b2545]">
            {formatCommissionNtd(r.commission)}
          </td>
          <td className="px-3 py-2.5 text-center">
            <button
              type="button"
              onClick={() => onToggle(r.id)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                r.received
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
              }`}
            >
              {r.received ? "已收" : "未收"}
            </button>
          </td>
          <td className="px-3 py-2.5 text-center">
            <button
              type="button"
              onClick={() => onEdit(r)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              編輯
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-100">
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}
