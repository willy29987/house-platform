"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListingCardItem } from "@/components/listing-card";
import { readFavoriteIds } from "@/lib/favorites";
import type { ListingCard } from "@/lib/listings";

export function FavoritesList() {
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const ids = readFavoriteIds();
    if (ids.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/listings/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setListings([]);
        return;
      }
      const data = (await res.json()) as ListingCard[];
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    function onStorage(e: StorageEvent) {
      if (e.key === "favorite_listing_ids") {
        void load();
      }
    }
    function onFavoritesChanged() {
      void load();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("favorites-changed", onFavoritesChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("favorites-changed", onFavoritesChanged);
    };
  }, [load]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-zinc-500">載入收藏中…</p>;
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl bg-zinc-50 p-12 text-center">
        <p className="text-base font-medium text-zinc-700">尚無收藏物件</p>
        <p className="mt-2 text-sm text-zinc-500">在物件詳情頁點星號即可加入，收藏將保留 60 天</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/rent"
            className="rounded-lg bg-[#0b2545] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
          >
            瀏覽租屋
          </Link>
          <Link
            href="/sale"
            className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-white"
          >
            瀏覽買屋
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {listings.map((listing) => (
        <ListingCardItem key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
