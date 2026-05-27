"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function ListingsPagination({
  page,
  totalPages,
  total,
  baseParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  baseParams: Record<string, string>;
}) {
  const scrollResetGen = useRef(0);
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      scrollTimers.current.forEach(clearTimeout);
      scrollTimers.current = [];
    };
  }, []);

  if (totalPages <= 1) return null;

  function buildHref(p: number) {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return `/listings${qs ? `?${qs}` : ""}`;
  }

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  // Pagination is a search-param-only nav (pathname stays /listings), so the
  // SmoothScroll route-change effect doesn't fire. We explicitly reset scroll
  // on click and re-pin across a couple of frames to defeat layout shifts as
  // the new page streams in. Lenis owns the scroll loop, so we sync both the
  // native scroll position and Lenis's internal state.
  //
  // prefetch={false} on every link — Next.js prefetches in-viewport page links
  // and can cache a transient empty RSC payload; clicking then shows "no results"
  // while pagination still reports the full total.
  function scrollToTop() {
    if (typeof window === "undefined") return;

    scrollTimers.current.forEach(clearTimeout);
    scrollTimers.current = [];

    const gen = ++scrollResetGen.current;
    const reset = () => {
      if (scrollResetGen.current !== gen) return;
      window.scrollTo(0, 0);
      const lenis = window.__lenisInstance;
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    };

    reset();
    requestAnimationFrame(() => {
      reset();
      requestAnimationFrame(reset);
    });
    scrollTimers.current.push(setTimeout(reset, 80), setTimeout(reset, 240));
  }

  return (
    <nav className="mt-12 flex flex-col items-center gap-4" aria-label="Pagination">
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? "home" : "homes"} found · Page {page} of {totalPages}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 && (
          <Link
            href={buildHref(page - 1)}
            prefetch={false}
            scroll={false}
            onClick={scrollToTop}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            ← Prev
          </Link>
        )}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 text-muted-foreground">…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              prefetch={false}
              scroll={false}
              {...(p !== page ? { onClick: scrollToTop } : {})}
              className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                p === page
                  ? "bg-foreground text-background"
                  : "border border-border text-foreground hover:bg-muted/30"
              }`}
            >
              {p}
            </Link>
          ),
        )}
        {page < totalPages && (
          <Link
            href={buildHref(page + 1)}
            prefetch={false}
            scroll={false}
            onClick={scrollToTop}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
