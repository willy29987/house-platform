"use client";

import { useState } from "react";

type FavoriteButtonProps = {
  listingId: string;
};

const FAVORITE_KEY = "favorite_listing_ids";

function readFavoriteIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(FAVORITE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function FavoriteButton({ listingId }: FavoriteButtonProps) {
  const [favorites, setFavorites] = useState<string[]>(() => readFavoriteIds());
  const isFavorite = favorites.includes(listingId);

  function toggleFavorite() {
    setFavorites((prev) => {
      const next = prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId];
      window.localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        isFavorite
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {isFavorite ? "已收藏" : "加入收藏"}
    </button>
  );
}
