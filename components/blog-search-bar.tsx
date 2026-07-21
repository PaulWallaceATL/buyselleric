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
    <form onSubmit={handleSubmit} className="w-full">
      <div className={inputWrap}>
        <div className="flex min-w-0 flex-1 items-center gap-3 pl-5 sm:pl-6">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="min-h-[52px] w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:min-h-[56px] sm:text-lg"
            aria-label="Search blog posts by title"
          />
        </div>
        <button
          type="submit"
          className="mr-2 flex min-h-[40px] items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.97] sm:mr-2.5 sm:min-h-[44px] sm:px-7 sm:text-base"
        >
          Search
        </button>
      </div>
    </form>
  );
}
