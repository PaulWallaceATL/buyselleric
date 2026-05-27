import { bridgeGetSearchSuggestions, isBridgeListingsEnabled } from "@/lib/bridge-listings";
import { localGaSearchSuggestions } from "@/lib/ga-location-suggest";
import { isSparkListingsEnabled, sparkGetSearchSuggestions } from "@/lib/spark-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchSuggestionType = "city" | "zip" | "address";

export interface SearchSuggestion {
  id: string;
  type: SearchSuggestionType;
  label: string;
  subtitle?: string;
  value: string;
  /**
   * When set, picking this suggestion navigates straight to this URL
   * (e.g. address → MLS detail page) instead of running a `?q=…` search.
   * Used to avoid the "no results" page when the autosuggest already knows
   * the canonical listing for an address row.
   */
  href?: string;
}

/** Strip characters that break PostgREST ilike filters. */
export function sanitizeSuggestQuery(raw: string): string {
  return raw.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

/** Merge suggestions from multiple feeds; dedupe by canonical city/zip value, not feed-specific ids. */
function suggestionDedupeKey(s: SearchSuggestion): string {
  const v = s.value.trim().toLowerCase().replace(/\s+/g, " ");
  if (s.type === "city") return `city:${v}`;
  if (s.type === "zip") return `zip:${v.replace(/\D/g, "")}`;
  return `addr:${s.id}`;
}

function mergeSuggestionsByType(...lists: SearchSuggestion[][]): SearchSuggestion[] {
  const seen = new Set<string>();
  const cities: SearchSuggestion[] = [];
  const zips: SearchSuggestion[] = [];
  const addrs: SearchSuggestion[] = [];
  for (const list of lists) {
    for (const s of list) {
      const key = suggestionDedupeKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      if (s.type === "city") cities.push(s);
      else if (s.type === "zip") zips.push(s);
      else addrs.push(s);
    }
  }
  return [...cities.slice(0, 6), ...zips.slice(0, 4), ...addrs.slice(0, 5)].slice(0, 12);
}

export async function getSearchSuggestions(raw: string): Promise<SearchSuggestion[]> {
  const q = sanitizeSuggestQuery(raw);
  if (q.length < 2) return [];

  const local = localGaSearchSuggestions(q);

  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  if (bridgeOn && sparkOn) {
    const settled = await Promise.allSettled([
      bridgeGetSearchSuggestions(q),
      sparkGetSearchSuggestions(q),
    ]);
    const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
    return mergeSuggestionsByType(local, ...lists);
  }
  if (bridgeOn) {
    return mergeSuggestionsByType(local, await bridgeGetSearchSuggestions(q));
  }
  if (sparkOn) {
    return mergeSuggestionsByType(local, await sparkGetSearchSuggestions(q));
  }

  const term = `%${q}%`;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const [
    mlsCityRows,
    mlsStateRows,
    mlsZips,
    mlsAddrLine,
    mlsTitleRows,
    manCityRows,
    manStateRows,
    manZips,
    manAddrLine,
    manTitleRows,
  ] = await Promise.all([
    supabase.from("mls_listings").select("city, state").eq("status", "active").ilike("city", term).limit(45),
    supabase.from("mls_listings").select("city, state").eq("status", "active").ilike("state", term).limit(20),
    supabase.from("mls_listings").select("postal_code, city, state").eq("status", "active").ilike("postal_code", term).limit(35),
    supabase.from("mls_listings").select("address_line, city, state, postal_code, mls_id").eq("status", "active").ilike("address_line", term).limit(16),
    supabase.from("mls_listings").select("address_line, city, state, postal_code, mls_id").eq("status", "active").ilike("title", term).limit(10),
    supabase.from("listings").select("city, state").eq("is_published", true).ilike("city", term).limit(25),
    supabase.from("listings").select("city, state").eq("is_published", true).ilike("state", term).limit(12),
    supabase.from("listings").select("postal_code, city, state").eq("is_published", true).ilike("postal_code", term).limit(20),
    supabase.from("listings").select("address_line, city, state, postal_code, slug").eq("is_published", true).ilike("address_line", term).limit(10),
    supabase.from("listings").select("address_line, city, state, postal_code, slug").eq("is_published", true).ilike("title", term).limit(8),
  ]);

  const out: SearchSuggestion[] = [];
  const seenCity = new Set<string>();
  const seenZip = new Set<string>();
  const seenAddr = new Set<string>();

  const addCity = (city: string, state: string) => {
    const c = city?.trim();
    const s = (state ?? "GA").trim();
    if (!c) return;
    const key = `${c.toLowerCase()}|${s.toLowerCase()}`;
    if (seenCity.has(key)) return;
    seenCity.add(key);
    out.push({
      id: `city-${key}`,
      type: "city",
      label: `${c}, ${s}`,
      subtitle: "City",
      value: `${c}, ${s}`,
    });
  };

  const addZip = (zip: string, city: string, state: string) => {
    const z = zip?.trim();
    if (!z) return;
    const key = z.toLowerCase();
    if (seenZip.has(key)) return;
    seenZip.add(key);
    const place = [city, state].filter(Boolean).join(", ");
    out.push({
      id: `zip-${key}`,
      type: "zip",
      label: z,
      subtitle: place ? `ZIP · ${place}` : "ZIP code",
      value: z,
    });
  };

  const addAddr = (line: string, city: string, state: string, zip: string, href?: string) => {
    const a = line?.trim();
    if (!a) return;
    const tail = [city, state, zip].filter(Boolean).join(", ");
    const key = `${a.toLowerCase()}|${tail.toLowerCase()}`;
    if (seenAddr.has(key)) return;
    seenAddr.add(key);
    const sug: SearchSuggestion = {
      id: `addr-${key.slice(0, 96)}`,
      type: "address",
      label: a,
      subtitle: tail || "Address",
      value: tail ? `${a}, ${tail}` : a,
    };
    if (href) sug.href = href;
    out.push(sug);
  };

  for (const row of (mlsCityRows.data ?? []) as { city?: string; state?: string }[]) {
    addCity(row.city ?? "", row.state ?? "");
  }
  for (const row of (mlsStateRows.data ?? []) as { city?: string; state?: string }[]) {
    addCity(row.city ?? "", row.state ?? "");
  }
  for (const row of (manCityRows.data ?? []) as { city?: string; state?: string }[]) {
    addCity(row.city ?? "", row.state ?? "");
  }
  for (const row of (manStateRows.data ?? []) as { city?: string; state?: string }[]) {
    addCity(row.city ?? "", row.state ?? "");
  }

  const cities = out.filter((s) => s.type === "city");

  for (const row of (mlsZips.data ?? []) as { postal_code?: string; city?: string; state?: string }[]) {
    addZip(row.postal_code ?? "", row.city ?? "", row.state ?? "");
  }
  for (const row of (manZips.data ?? []) as { postal_code?: string; city?: string; state?: string }[]) {
    addZip(row.postal_code ?? "", row.city ?? "", row.state ?? "");
  }

  const zips = out.filter((s) => s.type === "zip");

  const mlsAddrHref = (mlsId: string | undefined): string | undefined => {
    const id = mlsId?.trim();
    return id ? `/listings/mls/${encodeURIComponent(id)}` : undefined;
  };
  const manualAddrHref = (slug: string | undefined): string | undefined => {
    const s = slug?.trim();
    return s ? `/listings/${encodeURIComponent(s)}` : undefined;
  };

  for (const row of (mlsAddrLine.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    mls_id?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "", mlsAddrHref(row.mls_id));
  }
  for (const row of (mlsTitleRows.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    mls_id?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "", mlsAddrHref(row.mls_id));
  }
  for (const row of (manAddrLine.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    slug?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "", manualAddrHref(row.slug));
  }
  for (const row of (manTitleRows.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    slug?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "", manualAddrHref(row.slug));
  }

  const addrs = out.filter((s) => s.type === "address");

  return mergeSuggestionsByType(
    local,
    [...cities.slice(0, 6), ...zips.slice(0, 4), ...addrs.slice(0, 5)].slice(0, 12),
  );
}
