import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchSuggestionType = "city" | "zip" | "address";

export interface SearchSuggestion {
  id: string;
  type: SearchSuggestionType;
  label: string;
  subtitle?: string;
  value: string;
}

/** Strip characters that break PostgREST ilike filters. */
export function sanitizeSuggestQuery(raw: string): string {
  return raw.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

export async function getSearchSuggestions(raw: string): Promise<SearchSuggestion[]> {
  const q = sanitizeSuggestQuery(raw);
  if (q.length < 2) return [];

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
    supabase.from("mls_listings").select("address_line, city, state, postal_code").eq("status", "active").ilike("address_line", term).limit(16),
    supabase.from("mls_listings").select("address_line, city, state, postal_code").eq("status", "active").ilike("title", term).limit(10),
    supabase.from("listings").select("city, state").eq("is_published", true).ilike("city", term).limit(25),
    supabase.from("listings").select("city, state").eq("is_published", true).ilike("state", term).limit(12),
    supabase.from("listings").select("postal_code, city, state").eq("is_published", true).ilike("postal_code", term).limit(20),
    supabase.from("listings").select("address_line, city, state, postal_code").eq("is_published", true).ilike("address_line", term).limit(10),
    supabase.from("listings").select("address_line, city, state, postal_code").eq("is_published", true).ilike("title", term).limit(8),
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

  const addAddr = (line: string, city: string, state: string, zip: string) => {
    const a = line?.trim();
    if (!a) return;
    const tail = [city, state, zip].filter(Boolean).join(", ");
    const key = `${a.toLowerCase()}|${tail.toLowerCase()}`;
    if (seenAddr.has(key)) return;
    seenAddr.add(key);
    out.push({
      id: `addr-${key.slice(0, 96)}`,
      type: "address",
      label: a,
      subtitle: tail || "Address",
      value: tail ? `${a}, ${tail}` : a,
    });
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

  for (const row of (mlsAddrLine.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "");
  }
  for (const row of (mlsTitleRows.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "");
  }
  for (const row of (manAddrLine.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "");
  }
  for (const row of (manTitleRows.data ?? []) as {
    address_line?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }[]) {
    addAddr(row.address_line ?? "", row.city ?? "", row.state ?? "", row.postal_code ?? "");
  }

  const addrs = out.filter((s) => s.type === "address");

  return [...cities.slice(0, 6), ...zips.slice(0, 4), ...addrs.slice(0, 5)].slice(0, 12);
}
