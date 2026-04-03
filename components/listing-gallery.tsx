"use client";

import { useState } from "react";

export function ListingGallery({ urls }: { urls: string[] }) {
  const clean = urls.filter(Boolean);
  const [active, setActive] = useState(0);
  const safeIndex = clean.length === 0 ? 0 : Math.min(active, clean.length - 1);
  const main = clean[safeIndex];

  if (clean.length === 0) {
    return (
      <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted shadow-sm sm:aspect-21/9 sm:max-h-[min(70vh,720px)] sm:min-h-[320px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      {clean.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:gap-3">
          {clean.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-20 sm:w-28 ${
                i === safeIndex
                  ? "border-ring ring-2 ring-ring/30"
                  : "border-transparent opacity-80 hover:opacity-100"
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
