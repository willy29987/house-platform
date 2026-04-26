"use client";

import { useRef } from "react";
import { type ListingCard as ListingCardType } from "@/lib/listings";
import { ListingCardItem } from "@/components/listing-card";

type ListingCarouselProps = {
  title: string;
  badge: "RENT" | "SALE";
  listings: ListingCardType[];
};

export function ListingCarousel({ title, badge, listings }: ListingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth / 3;
    el.scrollBy({ left: direction === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  }

  const badgeLabel = badge === "RENT" ? "租賃" : "買賣";
  const badgeColor = badge === "RENT" ? "bg-blue-600" : "bg-emerald-600";

  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`rounded-full ${badgeColor} px-3 py-1 text-xs font-semibold text-white`}>
            {badgeLabel}
          </span>
          <h2 className="text-2xl font-bold text-zinc-900">{title}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            aria-label="上一個"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-900 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            aria-label="下一個"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-900 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50 p-10 text-center text-sm text-zinc-500">
          目前尚無{badgeLabel}物件
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {listings.map((listing) => (
            <ListingCardItem
              key={listing.id}
              listing={listing}
              className="w-full shrink-0 snap-start sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
