import { ListingsSpinner } from "@/components/listings-spinner";
import { siteContainer } from "@/lib/ui";
import type { ReactNode } from "react";

/** Shown during soft navigations between search pages — avoids flashing the empty state. */
export default function ListingsLoading(): ReactNode {
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
