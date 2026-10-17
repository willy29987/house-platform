import Link from "next/link";
import type { AdminListing } from "@/lib/listings";
import {
  filterUpcomingRentListings,
  formatRocDate,
  getDaysUntilRelease,
  sortUpcomingRentListingsByReleaseSoonest,
  unpublishCategoryLabel,
} from "@/lib/listing-internal-meta";

type AdminUpcomingReleaseProps = {
  listings: AdminListing[];
  currentUsername: string;
  isSuperAdmin: boolean;
};

export function AdminUpcomingRelease({ listings, currentUsername, isSuperAdmin }: AdminUpcomingReleaseProps) {
  const upcoming = sortUpcomingRentListingsByReleaseSoonest(
    filterUpcomingRentListings(listings, { currentUsername, isSuperAdmin }),
  );

  if (upcoming.length === 0) return null;

  const headline = isSuperAdmin
    ? `共 ${upcoming.length} 件即將在 2 個月內釋出，請提早安排刊登`
    : `你有 ${upcoming.length} 件物件即將釋出，請提前準備重新刊登`;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-100/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900 md:text-base">
          <span aria-hidden className="text-base md:text-lg">⏰</span>
          即將釋出物件提醒
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {upcoming.length}
          </span>
        </h2>
        <p className="text-xs font-medium text-amber-900/90 md:text-sm">{headline}</p>
      </div>
      <ul className="divide-y divide-amber-200/70">
        {upcoming.map((l) => {
          const days = getDaysUntilRelease(l.expectedReleaseDate);
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {days === 0 ? "今日釋出" : days != null ? `剩 ${days} 天` : "—"}
              </span>
              <Link
                href={`/admin/listings/${l.id}/edit`}
                className="min-w-0 flex-1 truncate font-semibold text-zinc-900 hover:text-[#0b2545] hover:underline"
              >
                {l.title}
              </Link>
              <span className="text-xs text-zinc-600">
                {l.city}
                {l.district}
              </span>
              <span className="text-xs text-zinc-600">
                預計 <span className="font-semibold text-amber-900">{formatRocDate(l.expectedReleaseDate)}</span>
              </span>
              {l.unpublishCategory ? (
                <span className="text-xs text-zinc-500">
                  {unpublishCategoryLabel(l.unpublishCategory)}
                </span>
              ) : null}
              {isSuperAdmin && l.createdByUsername ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-900/5 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                  業務 {l.createdByUsername}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
