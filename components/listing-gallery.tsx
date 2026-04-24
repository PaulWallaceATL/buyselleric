"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { filterDisplayImageUrls } from "@/lib/listing-urls";

export function ListingGallery({ urls }: { urls: string[] }) {
  const clean = filterDisplayImageUrls(urls);
  const [active, setActive] = useState(0);
  const safeIndex = clean.length === 0 ? 0 : Math.min(active, clean.length - 1);
  const main = clean[safeIndex];
  const n = clean.length;
  const multi = n > 1;

  const goPrev = useCallback(() => {
    setActive((i) => (n <= 1 ? i : (i - 1 + n) % n));
  }, [n]);

  const goNext = useCallback(() => {
    setActive((i) => (n <= 1 ? i : (i + 1) % n));
  }, [n]);

  if (clean.length === 0) {
    return (
      <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center text-base text-muted-foreground sm:rounded-3xl sm:text-lg">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted shadow-md sm:aspect-21/9 sm:max-h-[min(70vh,720px)] sm:min-h-[280px] sm:rounded-3xl lg:min-h-[320px]"
        aria-label={multi ? "Photo gallery" : undefined}
      >
        <Image
          src={main!}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 80vw"
          className="object-cover"
          priority
        />
        {multi ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  goPrev();
                }
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  goNext();
                }
              }}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-md backdrop-blur-sm transition-[background,transform] hover:bg-background active:scale-95 sm:left-4 sm:size-12"
            >
              <ChevronLeft className="size-6 sm:size-7" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  goPrev();
                }
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  goNext();
                }
              }}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-md backdrop-blur-sm transition-[background,transform] hover:bg-background active:scale-95 sm:right-4 sm:size-12"
            >
              <ChevronRight className="size-6 sm:size-7" strokeWidth={2} aria-hidden />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm sm:bottom-4 sm:text-sm">
              {safeIndex + 1} / {n}
            </div>
          </>
        ) : null}
      </div>
      {clean.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 sm:gap-4">
          {clean.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${clean.length}`}
              className={`relative min-h-[52px] min-w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:min-h-20 sm:min-w-[7.5rem] ${
                i === safeIndex
                  ? "border-ring ring-2 ring-ring/30"
                  : "border-border/60 opacity-90 hover:opacity-100"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
