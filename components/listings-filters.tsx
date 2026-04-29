"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const selectClass =
  "rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20";
const inputClass =
  "w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20";

const priceOptions = [
  { label: "No min", value: "" },
  { label: "$50k", value: "50000" },
  { label: "$100k", value: "100000" },
  { label: "$150k", value: "150000" },
  { label: "$200k", value: "200000" },
  { label: "$300k", value: "300000" },
  { label: "$400k", value: "400000" },
  { label: "$500k", value: "500000" },
  { label: "$750k", value: "750000" },
  { label: "$1M", value: "1000000" },
  { label: "$1.5M", value: "1500000" },
  { label: "$2M", value: "2000000" },
  { label: "$5M", value: "5000000" },
];

const priceMaxOptions = [
  { label: "No max", value: "" },
  ...priceOptions.slice(1),
  { label: "$10M", value: "10000000" },
];

const bedOptions = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
  { label: "5+", value: "5" },
];

const bathOptions = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
];

const sortOptions = [
  { label: "Price: high to low", value: "price_desc" },
  { label: "Price: low to high", value: "price_asc" },
  { label: "Largest first", value: "sqft_desc" },
  { label: "Newest", value: "newest" },
];

export function ListingsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const current = {
    q: searchParams.get("q") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    minBeds: searchParams.get("minBeds") ?? "",
    minBaths: searchParams.get("minBaths") ?? "",
    minSqft: searchParams.get("minSqft") ?? "",
    maxSqft: searchParams.get("maxSqft") ?? "",
    sort: searchParams.get("sort") ?? "price_desc",
    view: searchParams.get("view") ?? "list",
    mapPoly: searchParams.get("mapPoly") ?? "",
  };

  const activeFilterCount = [
    current.minPrice, current.maxPrice, current.minBeds,
    current.minBaths, current.minSqft, current.maxSqft,
  ].filter(Boolean).length;

  function applyFilters(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { ...current, ...overrides, page: "1" };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/listings?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    if (current.view !== "list") params.set("view", current.view);
    router.push(`/listings?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeFilterCount > 0
              ? "bg-ring text-white"
              : "border border-border text-foreground hover:bg-muted/30"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 4h18M6 8h12M9 12h6M11 16h2" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{activeFilterCount}</span>
          )}
        </button>

        <select
          value={current.sort}
          onChange={(e) => applyFilters({ sort: e.target.value })}
          className={`${selectClass} min-h-[40px]`}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-muted/10 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Min price</label>
            <select
              value={current.minPrice}
              onChange={(e) => applyFilters({ minPrice: e.target.value })}
              className={`${selectClass} w-full`}
            >
              {priceOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Max price</label>
            <select
              value={current.maxPrice}
              onChange={(e) => applyFilters({ maxPrice: e.target.value })}
              className={`${selectClass} w-full`}
            >
              {priceMaxOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Bedrooms</label>
            <select
              value={current.minBeds}
              onChange={(e) => applyFilters({ minBeds: e.target.value })}
              className={`${selectClass} w-full`}
            >
              {bedOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Bathrooms</label>
            <select
              value={current.minBaths}
              onChange={(e) => applyFilters({ minBaths: e.target.value })}
              className={`${selectClass} w-full`}
            >
              {bathOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Min sqft</label>
            <input
              type="number"
              value={current.minSqft}
              onChange={(e) => applyFilters({ minSqft: e.target.value })}
              placeholder="No min"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Max sqft</label>
            <input
              type="number"
              value={current.maxSqft}
              onChange={(e) => applyFilters({ maxSqft: e.target.value })}
              placeholder="No max"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}
