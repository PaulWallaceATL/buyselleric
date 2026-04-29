"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SearchSuggestionsList } from "@/components/search-suggestions-list";
import { useListingSearchSuggestions } from "@/components/use-listing-search-suggestions";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

export function ListingsSearchBar({
  defaultValue = "",
  baseParams,
}: {
  defaultValue?: string;
  /** Preserve map outline, filters, and view when changing the search box (merged with new q). */
  baseParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading, runSuggest } = useListingSearchSuggestions();

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    runSuggest(query);
  }, [query, runSuggest]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const goSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      setOpen(false);
      const p = new URLSearchParams();
      if (baseParams) {
        for (const [k, v] of Object.entries(baseParams)) {
          if (v) p.set(k, v);
        }
      }
      if (trimmed) p.set("q", trimmed);
      else p.delete("q");
      p.delete("page");
      const qs = p.toString();
      router.push(qs ? `/listings?${qs}` : "/listings", { scroll: false });
    },
    [router, baseParams],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goSearch(suggestions[activeIndex].value);
      return;
    }
    goSearch(query);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (suggestions.length > 0 || loading) && query.trim().length >= 2) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const pick = (s: SearchSuggestion) => {
    setQuery(s.value);
    goSearch(s.value);
  };

  const panelOpen = open && query.trim().length >= 2 && (loading || suggestions.length > 0);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/20 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <div className="flex flex-1 items-center gap-2.5 pl-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="City, address, or ZIP..."
              className="min-h-[42px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-base"
              aria-label="Search listings"
              aria-autocomplete="list"
              aria-expanded={panelOpen}
              aria-controls="listings-search-suggestions"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="mr-1.5 flex h-8 items-center rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:text-sm"
          >
            Search
          </button>
        </div>
        {panelOpen ? (
          <div id="listings-search-suggestions">
            <SearchSuggestionsList
              items={suggestions}
              activeIndex={activeIndex}
              onPick={pick}
              loading={loading}
              variant="bar"
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
