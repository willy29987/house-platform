import Link from "next/link";
import type { AdminListing } from "@/lib/listings";
import {
  filterExpiring591Listings,
  format591ExpiryLabel,
  getDaysUntil591Expiry,
  sortExpiring591ListingsSoonestFirst,
  SOURCE_591_EXPIRY_WARN_DAYS,
} from "@/lib/591-expiry";
import { formatRocDate } from "@/lib/listing-internal-meta";

type Props = {
  listings: AdminListing[];
  currentUsername: string;
  isSuperAdmin: boolean;
};

export function Admin591ExpiryAlert({ listings, currentUsername, isSuperAdmin }: Props) {
  const items = sortExpiring591ListingsSoonestFirst(
    filterExpiring591Listings(listings, { currentUsername, isSuperAdmin }),
  );
  if (items.length === 0) return null;

  const expired = items.filter((l) => (getDaysUntil591Expiry(l.source591ExpiresAt) ?? 0) < 0).length;
  const headline = expired
    ? `共 ${items.length} 件 591 廣告需注意（含 ${expired} 件已過期）`
    : `共 ${items.length} 件 591 廣告將在 ${SOURCE_591_EXPIRY_WARN_DAYS} 天內到期`;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/80 bg-rose-100/50 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-rose-950 md:text-base">
          591 廣告即將到期
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {items.length}
          </span>
        </h2>
        <p className="text-xs font-medium text-rose-900/90 md:text-sm">{headline}</p>
      </div>
      <ul className="divide-y divide-rose-200/70">
        {items.map((l) => {
          const days = getDaysUntil591Expiry(l.source591ExpiresAt);
          const urgent = days != null && days <= 3;
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                  urgent ? "bg-rose-600" : "bg-orange-500"
                }`}
              >
                {format591ExpiryLabel(l.source591ExpiresAt) || "—"}
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
                到期{" "}
                <span className="font-semibold text-rose-900">
                  {formatRocDate(l.source591ExpiresAt)}
                </span>
              </span>
              {l.source591Id ? (
                <span className="text-[11px] text-zinc-500">#{l.source591Id}</span>
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
