"use client";

import { useState } from "react";
import { readFavoriteIds, toggleFavoriteId } from "@/lib/favorites";

type ListingCardFavoriteProps = {
  listingId: string;
};

export function ListingCardFavorite({ listingId }: ListingCardFavoriteProps) {
  const [favorites, setFavorites] = useState<string[]>(() => readFavoriteIds());
  const isFavorite = favorites.includes(listingId);

  function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(toggleFavoriteId(listingId));
    window.dispatchEvent(new CustomEvent("favorites-changed"));
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "取消收藏" : "加入收藏"}
      title={isFavorite ? "取消收藏" : "加入收藏"}
      className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white hover:scale-105"
    >
      {isFavorite ? (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#facc15"
            stroke="#eab308"
            strokeWidth={1}
            strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ) : (
        <svg className="h-[18px] w-[18px] text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path
            strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      )}
    </button>
  );
}
