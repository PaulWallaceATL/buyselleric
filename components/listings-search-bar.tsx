"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ListingsSearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/listings");
      return;
    }
    router.push(`/listings?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/20 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        <div className="flex flex-1 items-center gap-2.5 pl-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, address, or ZIP..."
            className="min-h-[42px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-base"
            aria-label="Search listings"
          />
        </div>
        <button
          type="submit"
          className="mr-1.5 flex h-8 items-center rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:text-sm"
        >
          Search
        </button>
      </div>
    </form>
  );
}
