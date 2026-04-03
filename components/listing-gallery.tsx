"use client";

import { useState } from "react";

export function ListingGallery({ urls }: { urls: string[] }) {
  const clean = urls.filter(Boolean);
  const [active, setActive] = useState(0);
  const safeIndex = clean.length === 0 ? 0 : Math.min(active, clean.length - 1);
  const main = clean[safeIndex];

  if (clean.length === 0) {
    return (
      <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center text-base text-muted-foreground sm:rounded-3xl sm:text-lg">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted shadow-md sm:aspect-21/9 sm:max-h-[min(70vh,720px)] sm:min-h-[280px] sm:rounded-3xl lg:min-h-[320px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main}
          alt=""
          className="h-full w-full object-cover"
        />
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
