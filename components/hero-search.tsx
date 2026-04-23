"use client";

import { Search, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SearchSuggestionsList } from "@/components/search-suggestions-list";
import { useListingSearchSuggestions } from "@/components/use-listing-search-suggestions";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading, runSuggest } = useListingSearchSuggestions();

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
      if (!trimmed) return;
      setOpen(false);
      router.push(`/listings?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goSearch(suggestions[activeIndex].value);
      return;
    }
    goSearch(query);
  };

  const handleMapClick = () => {
    const trimmed = query.trim();
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}&view=map` : "?view=map";
    setOpen(false);
    router.push(`/listings${params}`);
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
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-2 rounded-full border-2 border-foreground/20 bg-background/80 shadow-lg backdrop-blur-md transition-colors focus-within:border-ring focus-within:shadow-xl">
          <div className="flex flex-1 items-center gap-3 pl-5 sm:pl-6">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search by city, address, or ZIP..."
              className="min-h-[52px] w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:min-h-[56px] sm:text-lg"
              aria-label="Search homes by city, address, or ZIP code"
              aria-autocomplete="list"
              aria-expanded={panelOpen}
              aria-controls="hero-search-suggestions"
              autoComplete="off"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pr-2">
            <button
              type="button"
              onClick={handleMapClick}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:h-11 sm:w-11"
              aria-label="Search on map"
              title="Map view"
            >
              <MapPin className="h-5 w-5" />
            </button>
            <button
              type="submit"
              className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:h-11 sm:px-6 sm:text-base"
            >
              Search
            </button>
          </div>
        </div>
        {panelOpen ? (
          <div id="hero-search-suggestions">
            <SearchSuggestionsList
              items={suggestions}
              activeIndex={activeIndex}
              onPick={pick}
              loading={loading}
              variant="hero"
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
