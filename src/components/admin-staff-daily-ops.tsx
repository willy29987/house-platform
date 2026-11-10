"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";
import { refreshOwnerTrackingFromCloud } from "@/lib/admin-cloud-sync-client";
import {
  emptyOwnerTrackingStore,
  formatFollowUpWhen,
  loadOwnerTrackingStoreLocal,
  normalizeOwnerTrackingStore,
  persistOwnerTrackingStoreFromCloud,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { ownerTrackingListHref } from "@/lib/owner-tracking-list-url";
import {
  buildStaffDailyOpsRows,
  listFollowUpsOnDate,
  normalizeStaffOpsDate,
} from "@/lib/owner-tracking-staff-stats";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

type Props = {
  currentUsername: string;
  isSuperAdmin: boolean;
  staffUsernames: string[];
  staffLabels?: Record<string, string>;
};

function formatDayBadge(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function AdminStaffDailyOps({
  currentUsername,
  isSuperAdmin,
  staffUsernames,
  staffLabels = {},
}: Props) {
  const [store, setStore] = useState<OwnerTrackingStore>(() => {
    if (typeof window === "undefined") return emptyOwnerTrackingStore;
    return normalizeOwnerTrackingStore(loadOwnerTrackingStoreLocal());
  });
  const [dayYmd, setDayYmd] = useState(() => taipeiTodayYmd());

  useEffect(() => {
    let cancelled = false;

    async function refreshFromCloud() {
      try {
        const next = await refreshOwnerTrackingFromCloud(
          loadOwnerTrackingStoreLocal,
          persistOwnerTrackingStoreFromCloud,
        );
        if (!cancelled) setStore(next);
      } catch {
        if (!cancelled) setStore(normalizeOwnerTrackingStore(loadOwnerTrackingStoreLocal()));
      }
    }

    void refreshFromCloud();

    // 首頁停留時也要跟上最新追蹤，避免「今日電訪」看起來沒更新
    const onFocus = () => {
      void refreshFromCloud();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshFromCloud();
    }, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  const today = taipeiTodayYmd();
  const selectedDay = normalizeStaffOpsDate(dayYmd);
  const isToday = selectedDay === today;

  const rows = useMemo(
    () =>
      buildStaffDailyOpsRows(store, {
        staffUsernames,
        currentUsername,
        isSuperAdmin,
        dayYmd: selectedDay,
      }),
    [store, staffUsernames, currentUsername, isSuperAdmin, selectedDay],
  );

  const dayFollowUps = useMemo(
    () => listFollowUpsOnDate(store, selectedDay),
    [store, selectedDay],
  );

  const totalCalls = rows.reduce((sum, row) => sum + row.followUpsToday, 0);
  const totalDue = rows.reduce((sum, row) => sum + row.contactDue, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 md:px-5">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-900 md:text-base">
          {isToday ? "今日作業" : "作業紀錄"}
          <span className="rounded-full bg-[#0b2545] px-2 py-0.5 text-[11px] font-bold text-white">
            {formatDayBadge(selectedDay)}
          </span>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <span className="sr-only">選擇日期</span>
            <input
              type="date"
              value={selectedDay}
              max={today}
              onChange={(e) => setDayYmd(normalizeStaffOpsDate(e.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800"
            />
          </label>
          {!isToday ? (
            <button
              type="button"
              onClick={() => setDayYmd(today)}
              className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              回今天
            </button>
          ) : null}
        </h2>
        <p className="text-xs text-zinc-600 md:text-sm">
          電訪{" "}
          <span className="font-semibold tabular-nums text-zinc-900">{totalCalls}</span>
          {isToday ? (
            <>
              {" · "}
              待聯繫{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{totalDue}</span>
            </>
          ) : (
            <span className="text-zinc-500">（歷史日只計當日送出的追蹤）</span>
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-500">尚無職員帳號</p>
      ) : (
        <ul
          className={
            isSuperAdmin
              ? "grid grid-cols-1 gap-0 divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-y-0 sm:gap-3 sm:p-3 md:grid-cols-3 lg:grid-cols-4"
              : "divide-y divide-zinc-100"
          }
        >
          {rows.map((row) => {
            const label = formatAdminStaffLabel(row.username, staffLabels);
            const isMe = row.username === currentUsername;
            const callsHref = ownerTrackingListHref({
              keyword: "",
              statusFilter: "ALL",
              propertyTypeFilter: "ALL",
              assigneeFilter: row.username,
              listing591Filter: "ALL",
              contactFilter: "ALL",
              page: 1,
            });
            const dueHref = ownerTrackingListHref({
              keyword: "",
              statusFilter: "ALL",
              propertyTypeFilter: "ALL",
              assigneeFilter: row.username,
              listing591Filter: "ALL",
              contactFilter: "DUE",
              page: 1,
            });
            return (
              <li
                key={row.username}
                className={
                  isSuperAdmin
                    ? "sm:rounded-xl sm:border sm:border-zinc-100 sm:bg-zinc-50/50 sm:p-3"
                    : "px-4 py-3"
                }
              >
                <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-0 sm:pt-0">
                  <p className="min-w-0 truncate text-sm font-semibold text-zinc-900" title={row.username}>
                    {label}
                    {isMe ? (
                      <span className="ml-1.5 text-[11px] font-medium text-zinc-500">（我）</span>
                    ) : null}
                  </p>
                </div>
                <div
                  className={`mt-2 grid gap-2 px-4 pb-3 sm:px-0 sm:pb-0 ${
                    isToday ? "grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  <Link
                    href={callsHref}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:border-[#0b2545]/30 hover:bg-sky-50/60"
                  >
                    <p className="text-[11px] font-medium text-zinc-500">
                      {isToday ? "今日電訪" : "當日電訪"}
                    </p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900">
                      {row.followUpsToday}
                    </p>
                  </Link>
                  {isToday ? (
                    <Link
                      href={dueHref}
                      className={`rounded-lg border px-3 py-2 hover:border-amber-400 hover:bg-amber-50/70 ${
                        row.contactDue > 0
                          ? "border-amber-200 bg-amber-50/50"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <p className="text-[11px] font-medium text-zinc-500">待聯繫</p>
                      <p
                        className={`mt-0.5 text-xl font-bold tabular-nums ${
                          row.contactDue > 0 ? "text-amber-900" : "text-zinc-900"
                        }`}
                      >
                        {row.contactDue}
                      </p>
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-zinc-100">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:px-5">
          <h3 className="text-sm font-bold text-zinc-900">當日追蹤明細</h3>
          <span className="text-xs tabular-nums text-zinc-500">{dayFollowUps.length} 筆</span>
        </div>
        {dayFollowUps.length === 0 ? (
          <p className="px-4 pb-5 text-center text-sm text-zinc-500">這天沒有追蹤紀錄</p>
        ) : (
          <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto border-t border-zinc-50">
            {dayFollowUps.map((item) => (
              <li key={item.id} className="px-4 py-2.5 text-sm md:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-zinc-900">
                    {formatAdminStaffLabel(item.createdBy, staffLabels)}
                    <span className="ml-2 text-xs font-medium text-zinc-500">
                      {formatFollowUpWhen(item.createdAt)}
                    </span>
                  </p>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-600">
                  {item.caseAddress || item.caseOwnerName || "—"}
                  {item.caseOwnerName ? ` · ${item.caseOwnerName}` : ""}
                </p>
                {item.note.trim() ? (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-800">{item.note.trim()}</p>
                ) : null}
                <Link
                  href={`/admin/owner-tracking/${encodeURIComponent(item.caseId)}`}
                  className="mt-1 inline-block text-[11px] font-semibold text-[#1e3a8a] hover:underline"
                >
                  打開案件
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
