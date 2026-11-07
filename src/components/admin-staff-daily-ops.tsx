"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";
import { hydrateOwnerTrackingStoreOnce } from "@/lib/admin-cloud-sync-client";
import {
  emptyOwnerTrackingStore,
  loadOwnerTrackingStoreLocal,
  normalizeOwnerTrackingStore,
  persistOwnerTrackingStoreFromCloud,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { ownerTrackingListHref } from "@/lib/owner-tracking-list-url";
import { buildStaffDailyOpsRows } from "@/lib/owner-tracking-staff-stats";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

type Props = {
  currentUsername: string;
  isSuperAdmin: boolean;
  staffUsernames: string[];
  staffLabels?: Record<string, string>;
};

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

  useEffect(() => {
    void hydrateOwnerTrackingStoreOnce(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud)
      .then((next) => setStore(next))
      .catch(() => setStore(normalizeOwnerTrackingStore(loadOwnerTrackingStoreLocal())));
  }, []);

  const rows = useMemo(
    () =>
      buildStaffDailyOpsRows(store, {
        staffUsernames,
        currentUsername,
        isSuperAdmin,
      }),
    [store, staffUsernames, currentUsername, isSuperAdmin],
  );

  const todayLabel = useMemo(() => {
    const ymd = taipeiTodayYmd();
    const [, m, d] = ymd.split("-");
    return `${Number(m)}/${Number(d)}`;
  }, []);

  const totalCalls = rows.reduce((sum, row) => sum + row.followUpsToday, 0);
  const totalDue = rows.reduce((sum, row) => sum + row.contactDue, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 md:px-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 md:text-base">
          今日作業
          <span className="rounded-full bg-[#0b2545] px-2 py-0.5 text-[11px] font-bold text-white">
            {todayLabel}
          </span>
        </h2>
        <p className="text-xs text-zinc-600 md:text-sm">
          {isSuperAdmin ? (
            <>
              全公司電訪{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{totalCalls}</span>
              {" · "}
              待聯繫{" "}
              <span className="font-semibold tabular-nums text-zinc-900">{totalDue}</span>
            </>
          ) : (
            <>電訪以屋主追蹤送出的紀錄計算；待聯繫為今日與已逾期</>
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
                <div className="mt-2 grid grid-cols-2 gap-2 px-4 pb-3 sm:px-0 sm:pb-0">
                  <Link
                    href={callsHref}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 hover:border-[#0b2545]/30 hover:bg-sky-50/60"
                  >
                    <p className="text-[11px] font-medium text-zinc-500">今日電訪</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900">
                      {row.followUpsToday}
                    </p>
                  </Link>
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
