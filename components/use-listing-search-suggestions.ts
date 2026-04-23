"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

export function useListingSearchSuggestions(debounceMs = 260, minChars = 2) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const seqRef = useRef(0);

  const runSuggest = useCallback(
    (raw: string) => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      const trimmed = raw.trim();
      if (trimmed.length < minChars) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      timerRef.current = window.setTimeout(async () => {
        const seq = ++seqRef.current;
        setLoading(true);
        try {
          const res = await fetch(`/api/listings/suggest?q=${encodeURIComponent(trimmed)}`);
          const data = (await res.json()) as { suggestions?: SearchSuggestion[] };
          if (seq !== seqRef.current) return;
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        } catch {
          if (seq === seqRef.current) setSuggestions([]);
        } finally {
          if (seq === seqRef.current) setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs, minChars],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { suggestions, loading, runSuggest };
}
