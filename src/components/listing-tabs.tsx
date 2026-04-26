"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";

type Listing = {
  id: string;
  title: string;
  city: string;
  district: string;
  price: number;
  areaPing: number;
  rooms: number;
  bathrooms: number;
  listingType: "RENT" | "SALE";
  coverImage: string | null;
};

type ListingTabsProps = {
  listings: Listing[];
  hasFilter: boolean;
};

function formatPrice(price: number) {
  return `NT$ ${price.toLocaleString("zh-TW")}`;
}

function getCoverImage(listing: Listing) {
  if (listing.coverImage) return listing.coverImage;
  const seed = encodeURIComponent(listing.title);
  return `https://picsum.photos/seed/${seed}/600/400`;
}

export function ListingTabs({ listings, hasFilter }: ListingTabsProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "RENT" | "SALE">("ALL");

  const filtered = listings.filter((l) =>
    activeTab === "ALL" ? true : l.listingType === activeTab,
  );

  const tabs: { key: "ALL" | "RENT" | "SALE"; label: string }[] = [
    { key: "ALL", label: `全部（${listings.length}）` },
    { key: "RENT", label: `租賃（${listings.filter((l) => l.listingType === "RENT").length}）` },
    { key: "SALE", label: `買賣（${listings.filter((l) => l.listingType === "SALE").length}）` },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-zinc-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-zinc-900 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
          <p>目前沒有符合條件的房源。</p>
          {hasFilter ? (
            <p className="mt-2">
              你可以放寬篩選條件，或
              <Link
                href="/"
                className="ml-1 font-medium text-zinc-900 underline underline-offset-2"
              >
                清除篩選
              </Link>
              重新查看全部。
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <article
              key={listing.id}
              className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200"
            >
              <Link href={`/listings/${listing.id}`} className="block">
                <div className="relative h-48 w-full">
                  <Image
                    src={getCoverImage(listing)}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      listing.listingType === "RENT"
                        ? "bg-blue-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {listing.listingType === "RENT" ? "租賃" : "買賣"}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xs text-zinc-500">
                    {listing.city}
                    {listing.district}
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-base font-semibold text-zinc-900">
                    {listing.title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {listing.rooms} 房 {listing.bathrooms} 衛 ・ {listing.areaPing} 坪
                  </p>
                  <p className="mt-2 text-lg font-bold text-zinc-900">
                    {formatPrice(listing.price)}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between px-4 pb-4">
                <Link
                  href={`/listings/${listing.id}`}
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                >
                  查看詳情
                </Link>
                <FavoriteButton listingId={listing.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
