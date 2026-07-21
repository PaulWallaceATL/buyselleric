"use client";

import { Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useListingsNavigate } from "@/components/listings-nav-context";
import { dreamChipsFromSearchParams, type DreamChip } from "@/lib/dream-home-intent";

export function DreamFilterChips() {
  const router = useRouter();
  const navigate = useListingsNavigate();
  const searchParams = useSearchParams();

  const dreamText = searchParams.get("dream") ?? "";
  const soft = searchParams.get("soft") ?? "";

  const chips = useMemo(() => {
    const q = searchParams.get("q");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minBeds = searchParams.get("minBeds");
    const minBaths = searchParams.get("minBaths");
    const minSqft = searchParams.get("minSqft");
    const maxSqft = searchParams.get("maxSqft");
    const propertyType = searchParams.get("propertyType");
    const pool = searchParams.get("pool");
    const garage = searchParams.get("garage");
    const fireplace = searchParams.get("fireplace");
    const waterfront = searchParams.get("waterfront");
    const minYear = searchParams.get("minYear");
    const maxYear = searchParams.get("maxYear");
    const maxStories = searchParams.get("maxStories");
    const minAcres = searchParams.get("minAcres");
    const noHoa = searchParams.get("noHoa");
    return dreamChipsFromSearchParams({
      ...(q ? { q } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {}),
      ...(minBeds ? { minBeds } : {}),
      ...(minBaths ? { minBaths } : {}),
      ...(minSqft ? { minSqft } : {}),
      ...(maxSqft ? { maxSqft } : {}),
      ...(propertyType ? { propertyType } : {}),
      ...(soft ? { soft } : {}),
      ...(pool ? { pool } : {}),
      ...(garage ? { garage } : {}),
      ...(fireplace ? { fireplace } : {}),
      ...(waterfront ? { waterfront } : {}),
      ...(minYear ? { minYear } : {}),
      ...(maxYear ? { maxYear } : {}),
      ...(maxStories ? { maxStories } : {}),
      ...(minAcres ? { minAcres } : {}),
      ...(noHoa ? { noHoa } : {}),
    });
  }, [searchParams, soft]);

  const show = Boolean(dreamText) || chips.length > 0;
  if (!show) return null;

  function pushParams(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    navigate(qs ? `/listings?${qs}` : "/listings", router.push);
  }

  function removeChip(chip: DreamChip) {
    const next = new URLSearchParams(searchParams.toString());
    if (chip.kind === "hard") {
      next.delete(chip.param);
    } else if (chip.softIndex != null) {
      const list = soft
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      list.splice(chip.softIndex, 1);
      if (list.length) next.set("soft", list.join("|"));
      else next.delete("soft");
    }
    pushParams(next);
  }

  function clearDream() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("dream");
    next.delete("soft");
    for (const k of [
      "pool",
      "garage",
      "fireplace",
      "waterfront",
      "minYear",
      "maxYear",
      "maxStories",
      "minAcres",
      "noHoa",
    ]) {
      next.delete(k);
    }
    pushParams(next);
  }

  const hard = chips.filter((c) => c.kind === "hard");
  const softChips = chips.filter((c) => c.kind === "soft");

  return (
    <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 sm:rounded-3xl sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-ring" aria-hidden />
            Dream home filters
          </p>
          {dreamText ? (
            <p className="mt-1 text-sm text-foreground/90 line-clamp-2" title={dreamText}>
              “{dreamText}”
            </p>
          ) : null}
        </div>
        {dreamText || soft ? (
          <button
            type="button"
            onClick={clearDream}
            className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear dream note
          </button>
        ) : null}
      </div>

      {hard.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Search filters from your description">
          {hard.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                title={`Remove ${chip.label}`}
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {softChips.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            Also ranking by listing remarks for:
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2" aria-label="Preferences noted but not filtered">
            {softChips.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ring/40 bg-ring/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-ring/20"
                  title={`Remove noted preference: ${chip.label}`}
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
