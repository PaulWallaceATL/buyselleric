"use client";

import { MapPin, Home, Hash } from "lucide-react";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

function SuggestIcon({ type }: { type: SearchSuggestion["type"] }) {
  if (type === "city") return <MapPin className="h-4 w-4 shrink-0 text-ring" aria-hidden />;
  if (type === "zip") return <Hash className="h-4 w-4 shrink-0 text-ring" aria-hidden />;
  return <Home className="h-4 w-4 shrink-0 text-ring" aria-hidden />;
}

export function SearchSuggestionsList({
  items,
  activeIndex,
  onPick,
  loading,
  variant = "hero",
}: {
  items: SearchSuggestion[];
  activeIndex: number;
  onPick: (s: SearchSuggestion) => void;
  loading: boolean;
  variant?: "hero" | "bar";
}) {
  const show = loading || items.length > 0;
  if (!show) return null;

  const pad = variant === "hero" ? "py-2.5" : "py-2";
  const textMain = variant === "hero" ? "text-base" : "text-sm";
  const textSub = variant === "hero" ? "text-sm" : "text-xs";

  return (
    <ul
      role="listbox"
      aria-label="Search suggestions"
      data-lenis-prevent
      className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[min(70vh,22rem)] overflow-y-auto overscroll-y-contain rounded-2xl border border-border bg-background py-1 shadow-xl [-webkit-overflow-scrolling:touch]"
    >
      {loading && items.length === 0 && (
        <li className={`px-4 ${pad} ${textSub} text-muted-foreground`} role="presentation">
          Searching listings…
        </li>
      )}
      {items.map((s, i) => (
        <li key={s.id} role="option" aria-selected={i === activeIndex} className="list-none">
          <button
            type="button"
            className={`flex w-full items-start gap-3 px-4 text-left transition-colors ${
              pad
            } ${i === activeIndex ? "bg-muted/80" : "hover:bg-muted/50"}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(s);
            }}
          >
            <SuggestIcon type={s.type} />
            <span className="min-w-0 flex-1">
              <span className={`block font-medium text-foreground ${textMain}`}>{s.label}</span>
              {s.subtitle ? (
                <span className={`mt-0.5 block text-muted-foreground ${textSub}`}>{s.subtitle}</span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
