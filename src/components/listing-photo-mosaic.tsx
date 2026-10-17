"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type ListingPhotoMosaicProps = {
  title: string;
  coverImage: string | null;
  images?: string[];
};

/** 依可見照片數量決定每一格的大小（桌機為 4 欄 x 2 列，手機只顯示第一張）。 */
function tileClass(index: number, visibleCount: number) {
  if (index === 0) {
    return visibleCount === 1 ? "col-span-4 row-span-2" : "col-span-4 row-span-2 md:col-span-2";
  }
  const rest = visibleCount - 1;
  if (rest === 1) return "hidden md:block md:col-span-2 md:row-span-2";
  if (rest === 2) return "hidden md:block md:col-span-2";
  if (rest === 3) return index === 1 ? "hidden md:block md:col-span-2" : "hidden md:block";
  return "hidden md:block";
}

export function ListingPhotoMosaic({ title, coverImage, images }: ListingPhotoMosaicProps) {
  const all = useMemo(() => {
    const list = images && images.length > 0 ? [...images] : [];
    if (coverImage) {
      const idx = list.indexOf(coverImage);
      if (idx >= 0) list.splice(idx, 1);
      list.unshift(coverImage);
    }
    return list;
  }, [coverImage, images]);

  const total = all.length;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close, prev, next]);

  function openAt(i: number) {
    setIndex(i);
    setOpen(true);
  }

  if (total === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-400 md:h-[26rem]">
        尚未上傳圖片
      </div>
    );
  }

  const visible = all.slice(0, 5);

  return (
    <>
      <div className="relative">
        <div className="grid h-60 grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-xl md:h-[26rem] md:gap-2">
          {visible.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => openAt(i)}
              aria-label={`檢視第 ${i + 1} 張照片`}
              className={`relative overflow-hidden bg-zinc-100 ${tileClass(i, visible.length)}`}
            >
              <Image
                src={url}
                alt={`${title}-${i + 1}`}
                fill
                priority={i === 0}
                className="object-cover transition duration-300 hover:scale-[1.03]"
                sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow ring-1 ring-zinc-200 hover:bg-white sm:text-sm"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
          </svg>
          查看全部 {total} 張照片
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="物件照片"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-medium">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="關閉"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="relative min-h-0 flex-1" onClick={close}>
            <Image
              src={all[index]}
              alt={`${title}-${index + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              onClick={(event) => event.stopPropagation()}
            />
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    prev();
                  }}
                  aria-label="上一張"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    next();
                  }}
                  aria-label="下一張"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            ) : null}
          </div>

          {total > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {all.map((url, i) => (
                <button
                  key={`thumb-${url}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`第 ${i + 1} 張`}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 ${
                    i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
