"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

type ListingGalleryProps = {
  title: string;
  coverImage: string | null;
  images?: string[];
};

export function ListingGallery({ title, coverImage, images }: ListingGalleryProps) {
  const allImages = useMemo(() => {
    const list = images && images.length > 0 ? [...images] : [];
    if (coverImage) {
      if (list.includes(coverImage)) {
        const idx = list.indexOf(coverImage);
        list.splice(idx, 1);
      }
      list.unshift(coverImage);
    }
    return list;
  }, [coverImage, images]);

  const [currentIndex, setCurrentIndex] = useState(0);

  if (allImages.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <div className="flex h-72 w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-400 sm:h-96">
          尚未上傳圖片
        </div>
      </section>
    );
  }

  const currentImage = allImages[currentIndex] ?? allImages[0];
  const canNavigate = allImages.length > 1;

  function goPrev() {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }

  function goNext() {
    setCurrentIndex((prev) => (prev + 1) % allImages.length);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="relative overflow-hidden rounded-xl">
        <div className="relative h-72 w-full sm:h-[28rem]">
          <Image src={currentImage} alt={title} fill className="object-cover" sizes="100vw" priority />
        </div>
        {canNavigate ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="上一張"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="下一張"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              {currentIndex + 1} / {allImages.length}
            </span>
          </>
        ) : null}
      </div>
      {canNavigate ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {allImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`shrink-0 overflow-hidden rounded-md border-2 transition ${
                index === currentIndex ? "border-[#0b2545]" : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <div className="relative h-16 w-24">
                <Image
                  src={image}
                  alt={`${title}-${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
