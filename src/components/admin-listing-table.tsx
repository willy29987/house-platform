"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ToggleListingButton } from "@/components/toggle-listing-button";

type AdminListing = {
  id: string;
  title: string;
  listingType: "RENT" | "SALE";
  city: string;
  district: string;
  address?: string;
  community?: string | null;
  price: number;
  isPublished: boolean;
  createdAt: Date;
};

type AdminListingTableProps = {
  listings: AdminListing[];
};

function formatAdminPrice(price: number, type: "RENT" | "SALE") {
  if (type === "RENT") {
    return `NT$ ${price.toLocaleString("zh-TW")} / 月`;
  }
  if (price >= 100000000) {
    const value = price / 100000000;
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)} 億`;
  }
  const wan = price / 10000;
  return `${wan.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;
}

type TypeTab = "RENT" | "SALE";
type StatusTab = "PUBLISHED" | "UNPUBLISHED";

export function AdminListingTable({ listings }: AdminListingTableProps) {
  const [typeTab, setTypeTab] = useState<TypeTab>("RENT");
  const [statusTab, setStatusTab] = useState<StatusTab>("PUBLISHED");
  const [keyword, setKeyword] = useState("");

  const counts = useMemo(() => {
    const c = {
      RENT: { PUBLISHED: 0, UNPUBLISHED: 0 },
      SALE: { PUBLISHED: 0, UNPUBLISHED: 0 },
    };
    for (const l of listings) {
      c[l.listingType][l.isPublished ? "PUBLISHED" : "UNPUBLISHED"]++;
    }
    return c;
  }, [listings]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return listings
      .filter((l) => l.listingType === typeTab)
      .filter((l) => (statusTab === "PUBLISHED" ? l.isPublished : !l.isPublished))
      .filter((l) => {
        if (!k) return true;
        const hay =
          `${l.title}${l.city}${l.district}${l.address ?? ""}${l.community ?? ""}`.toLowerCase();
        return hay.includes(k);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [listings, typeTab, statusTab, keyword]);

  const typeTabs: { key: TypeTab; label: string }[] = [
    { key: "RENT", label: `租賃（${counts.RENT.PUBLISHED + counts.RENT.UNPUBLISHED}）` },
    { key: "SALE", label: `買賣（${counts.SALE.PUBLISHED + counts.SALE.UNPUBLISHED}）` },
  ];

  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: "PUBLISHED", label: `上架中（${counts[typeTab].PUBLISHED}）` },
    { key: "UNPUBLISHED", label: `已下架（${counts[typeTab].UNPUBLISHED}）` },
  ];

  return (
    <div>
      <div className="mb-3 flex gap-2 border-b border-zinc-200">
        {typeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTypeTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              typeTab === tab.key
                ? "border-b-2 border-zinc-900 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusTab(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusTab === tab.key
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋 標題 / 地區 / 社區"
            className="w-64 rounded-full border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          此分類目前沒有房源。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="px-2 py-2">標題</th>
                <th className="px-2 py-2">區域</th>
                <th className="px-2 py-2">價格</th>
                <th className="px-2 py-2">上下架</th>
                <th className="px-2 py-2">編輯</th>
                <th className="px-2 py-2">建立日</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing) => (
                <tr key={listing.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="font-medium text-zinc-800 hover:text-zinc-950"
                    >
                      {listing.title}
                    </Link>
                  </td>
                  <td className="px-2 py-3">{listing.city + listing.district}</td>
                  <td className="px-2 py-3 font-semibold text-zinc-900">
                    {formatAdminPrice(listing.price, listing.listingType)}
                  </td>
                  <td className="px-2 py-3">
                    <ToggleListingButton
                      listingId={listing.id}
                      isPublished={listing.isPublished}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/admin/listings/${listing.id}/edit`}
                      className="text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
                    >
                      修改內容
                    </Link>
                  </td>
                  <td className="px-2 py-3">
                    {new Intl.DateTimeFormat("zh-TW").format(listing.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
