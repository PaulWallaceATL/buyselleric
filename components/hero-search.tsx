"use client";

import { Search, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/listings?q=${encodeURIComponent(trimmed)}`);
  };

  const handleMapClick = () => {
    const trimmed = query.trim();
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}&view=map` : "?view=map";
    router.push(`/listings${params}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border-2 border-foreground/20 bg-background/80 shadow-lg backdrop-blur-md transition-colors focus-within:border-ring focus-within:shadow-xl">
        <div className="flex flex-1 items-center gap-3 pl-5 sm:pl-6">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by city, address, or ZIP..."
            className="min-h-[52px] w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:min-h-[56px] sm:text-lg"
            aria-label="Search homes by city, address, or ZIP code"
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
    </form>
  );
}
