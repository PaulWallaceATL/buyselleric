"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputWrap =
  "flex items-center gap-2 rounded-full border border-border bg-muted/20 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20";

export function BlogSearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/blog?${qs}` : "/blog", { scroll: false });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className={inputWrap}>
        <div className="flex flex-1 items-center gap-2.5 pl-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="min-h-[42px] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-base"
            aria-label="Search blog posts by title"
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
