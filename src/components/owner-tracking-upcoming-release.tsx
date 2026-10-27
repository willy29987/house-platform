"use client";

import Link from "next/link";
import { formatRocDate, getDaysUntilRelease } from "@/lib/listing-internal-meta";
import { formatOwnerCaseAddress } from "@/lib/owner-tracking-preview";
import { filterUpcomingOwnerCases, sortOwnerCasesByReleaseSoonest } from "@/lib/owner-tracking-release";
import type { OwnerTrackingStore } from "@/lib/owner-tracking-preview";
import { appendOwnerTrackingListContext } from "@/lib/owner-tracking-list-url";

type Props = {
  store: OwnerTrackingStore;
  listQuery: string;
  currentUsername: string;
  isSuperAdmin: boolean;
};

export function OwnerTrackingUpcomingRelease({
  store,
  listQuery,
  currentUsername,
  isSuperAdmin,
}: Props) {
  const upcoming = sortOwnerCasesByReleaseSoonest(
    store,
    filterUpcomingOwnerCases(store, store.cases, { currentUsername, isSuperAdmin }),
  );

  if (upcoming.length === 0) return null;

  const headline = isSuperAdmin
    ? `共 ${upcoming.length} 件屋主案即將滿一年可再開發（591 曾下架）`
    : `你有 ${upcoming.length} 件屋主案即將可再聯繫開發`;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-100/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900 md:text-base">
          <span aria-hidden className="text-base md:text-lg">
            ⏰
          </span>
          屋主追蹤 · 即將釋出提醒
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {upcoming.length}
          </span>
        </h2>
        <p className="text-xs font-medium text-amber-900/90 md:text-sm">{headline}</p>
      </div>
      <ul className="divide-y divide-amber-200/70">
        {upcoming.map((c) => {
          const days = getDaysUntilRelease(c.expectedReleaseDate);
          const href = appendOwnerTrackingListContext(
            `/admin/owner-tracking/${c.id}`,
            listQuery,
          );
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {days === 0 ? "今日可再開發" : days != null ? `剩 ${days} 天` : "—"}
              </span>
              <Link
                href={href}
                className="min-w-0 flex-1 truncate font-semibold text-zinc-900 hover:text-[#0b2545] hover:underline"
              >
                {formatOwnerCaseAddress(c) || c.ownerName || "—"}
              </Link>
              <span className="text-xs text-zinc-600">{c.ownerName}</span>
              <span className="text-xs text-zinc-600">
                預計 <span className="font-semibold text-amber-900">{formatRocDate(c.expectedReleaseDate)}</span>
              </span>
              {isSuperAdmin ? (
                <span className="ml-auto text-[11px] font-semibold text-zinc-600">{c.assignee}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
