"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import {
  filterDisplayImageUrls,
  listingImagePreferUnoptimized,
  upgradeMlsPhotoUrlsForDetail,
} from "@/lib/listing-urls";

type ListingGalleryProps = {
  urls: string[];
  /** Edge-to-edge hero + thumbnail strip (property detail). */
  variant?: "default" | "fullBleed";
};

export function ListingGallery({ urls, variant = "default" }: ListingGalleryProps) {
  const fullBleed = variant === "fullBleed";
  const clean = useMemo(
    () => upgradeMlsPhotoUrlsForDetail(filterDisplayImageUrls(urls)),
    [urls],
  );

  // MLS feeds occasionally return URLs that 404, redirect to HTML, or the
  // Next image optimizer rejects upstream. Track those per render so the
  // gallery silently skips them instead of leaving blank slots.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const markFailed = useCallback((url: string) => {
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const visible = useMemo(
    () => clean.filter((u) => !failedUrls.has(u)),
    [clean, failedUrls],
  );

  const [active, setActive] = useState(0);
  const n = visible.length;
  const safeIndex = n === 0 ? 0 : Math.min(active, n - 1);
  const main = visible[safeIndex];
  const multi = n > 1;

  const goPrev = useCallback(() => {
    setActive((i) => (n <= 1 ? i : (i - 1 + n) % n));
  }, [n]);

  const goNext = useCallback(() => {
    setActive((i) => (n <= 1 ? i : (i + 1) % n));
  }, [n]);

  if (n === 0) {
    return (
      <div
        className={
          fullBleed
            ? "flex min-h-[40vh] w-full items-center justify-center border-b border-border bg-muted/30 p-6 text-center text-base text-muted-foreground sm:min-h-[50vh] sm:text-lg"
            : "flex aspect-4/3 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center text-base text-muted-foreground sm:rounded-3xl sm:text-lg"
        }
      >
        Photos coming soon
      </div>
    );
  }

  const navBtn =
    "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg ring-1 ring-black/15 transition-[background,transform,box-shadow] hover:bg-white hover:shadow-xl active:scale-95 sm:size-12 md:size-14";

  return (
    <div className={fullBleed ? "w-full space-y-2 sm:space-y-3" : "space-y-4"}>
      <div
        className={
          fullBleed
            ? "relative aspect-[16/10] w-full overflow-hidden bg-muted sm:aspect-[21/9] sm:min-h-[min(58vh,640px)] sm:max-h-[min(72vh,780px)]"
            : "relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted shadow-md sm:aspect-21/9 sm:max-h-[min(70vh,720px)] sm:min-h-[280px] sm:rounded-3xl lg:min-h-[320px]"
        }
        aria-label={multi ? "Photo gallery" : undefined}
      >
        <Image
          key={main!}
          src={main!}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
          quality={95}
          unoptimized={listingImagePreferUnoptimized(main!)}
          onError={() => markFailed(main!)}
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
              className={`${navBtn} left-2 sm:left-4 md:left-6`}
            >
              <ChevronLeft
                className="size-5 text-neutral-900 sm:size-6 md:size-7"
                strokeWidth={2.5}
                aria-hidden
              />
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
              className={`${navBtn} right-2 sm:right-4 md:right-6`}
            >
              <ChevronRight
                className="size-5 text-neutral-900 sm:size-6 md:size-7"
                strokeWidth={2.5}
                aria-hidden
              />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm sm:bottom-5 sm:px-3.5 sm:text-sm">
              {safeIndex + 1} / {n}
            </div>
          </>
        ) : null}
      </div>
      {n > 1 ? (
        <div
          className={
            fullBleed
              ? "flex gap-2 overflow-x-auto px-0 pb-1 sm:gap-2.5"
              : "flex gap-3 overflow-x-auto pb-2 sm:gap-4"
          }
        >
          {visible.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${n}`}
              aria-current={i === safeIndex ? "true" : undefined}
              className={
                fullBleed
                  ? `relative aspect-[4/3] h-[4.25rem] shrink-0 overflow-hidden sm:h-24 ${
                      i === safeIndex
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        : "opacity-80 hover:opacity-100"
                    }`
                  : `relative min-h-[52px] min-w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:min-h-20 sm:min-w-[7.5rem] ${
                      i === safeIndex
                        ? "border-ring ring-2 ring-ring/30"
                        : "border-border/60 opacity-90 hover:opacity-100"
                    }`
              }
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="160px"
                className="object-cover"
                loading="lazy"
                unoptimized={listingImagePreferUnoptimized(url)}
                onError={() => markFailed(url)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
