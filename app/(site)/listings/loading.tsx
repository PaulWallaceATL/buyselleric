"use client";

import { ListingsSpinner } from "@/components/listings-spinner";
import { siteContainer } from "@/lib/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function isListingDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (/^\/listings\/mls\/[^/]+\/?$/.test(pathname)) return true;
  // Manual listing detail: /listings/{slug} — not the browse index
  if (/^\/listings\/[^/]+\/?$/.test(pathname) && !pathname.startsWith("/listings/mls")) {
    return pathname !== "/listings";
  }
  return false;
}

function SearchHomesLoading(): ReactNode {
  return (
    <div className={siteContainer} aria-busy="true" aria-label="Loading listings">
      <div className="flex flex-col items-center justify-center py-16 sm:py-20">
        <ListingsSpinner />
        <p className="mt-4 text-sm font-medium text-foreground">Loading homes…</p>
        <p className="mt-1 text-xs text-muted-foreground">Searching MLS listings</p>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border/90 bg-muted/20 sm:rounded-3xl"
          >
            <div className="aspect-[4/3] animate-pulse bg-muted" />
            <div className="space-y-3 p-5 sm:p-6">
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleHomeLoading(): ReactNode {
  return (
    <div className={`${siteContainer} max-w-4xl`} aria-busy="true" aria-label="Loading listing">
      <div className="flex flex-col items-center justify-center py-12 sm:py-16">
        <ListingsSpinner />
        <p className="mt-4 text-sm font-medium text-foreground">Loading this home…</p>
        <p className="mt-1 text-xs text-muted-foreground">Fetching listing details</p>
      </div>
      <div className="mt-2 space-y-6">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted sm:rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Soft-nav loading for /listings and nested routes — copy matches search vs single detail. */
export default function ListingsLoading(): ReactNode {
  const pathname = usePathname();
  if (isListingDetailPath(pathname)) {
    return <SingleHomeLoading />;
  }
  return <SearchHomesLoading />;
}
