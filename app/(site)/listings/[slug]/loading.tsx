import { ListingsSpinner } from "@/components/listings-spinner";
import { siteContainer } from "@/lib/ui";
import type { ReactNode } from "react";

/** Instant UI while a manual listing detail page resolves. */
export default function ManualListingLoading(): ReactNode {
  return (
    <div className={`${siteContainer} max-w-4xl`} aria-busy="true" aria-label="Loading listing">
      <div className="flex flex-col items-center justify-center py-12 sm:py-16">
        <ListingsSpinner />
        <p className="mt-4 text-sm font-medium text-foreground">Loading this home…</p>
        <p className="mt-1 text-xs text-muted-foreground">Fetching listing details</p>
      </div>
      <div className="mt-2 space-y-6">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted sm:rounded-3xl" />
      </div>
    </div>
  );
}
