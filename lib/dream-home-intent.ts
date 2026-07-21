import OpenAI from "openai";
import { siteConfig } from "@/lib/config";
import { detectGaLocationInText } from "@/lib/ga-location-suggest";
import { heuristicDreamExtract } from "@/lib/dream-home-match";
import {
  softPrefsToAmenities,
  writeAmenitiesToSearchParams,
  amenityChipsFromParams,
  type ListingAmenities,
} from "@/lib/listing-amenities";
import type { ListingFilters } from "@/lib/listings-queries";

let _client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Hard filters we can apply today via ListingFilters / URL params. */
export type DreamHomeHardFilters = {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyType?: string;
  sort?: NonNullable<ListingFilters["sort"]>;
};

export type DreamHomeIntent = {
  filters: DreamHomeHardFilters;
  /**
   * Lifestyle / amenity phrases — used to rank homes (remarks / description match).
   * Shown as editable chips. Amenities that promote to hard filters are also listed here
   * so ranking still helps when MLS amenity fields are sparse.
   */
  softPrefs: string[];
  /** Structured amenity hard-filters promoted from soft prefs / heuristics. */
  amenities: ListingAmenities;
  /** Short plain-language summary of what we understood. */
  summary: string;
};

const SYSTEM_PROMPT = `You parse natural-language home-buyer descriptions into structured MLS search filters for ${siteConfig.name} (${siteConfig.agentName}), serving ${siteConfig.primaryMarket}.

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "q": string | null,
  "minPrice": number | null,
  "maxPrice": number | null,
  "minBeds": number | null,
  "minBaths": number | null,
  "minSqft": number | null,
  "maxSqft": number | null,
  "propertyType": string | null,
  "sort": "price_asc" | "price_desc" | "newest" | "sqft_desc" | null,
  "softPrefs": string[],
  "summary": string
}

Rules:
- q: city, neighborhood, ZIP, or "City, ST" when a location is clear. Prefer Georgia localities. Null if no location.
- Prices in whole US dollars (e.g. 450000 for $450k). Parse "under 500k", "around 300k", budgets honestly.
- minBeds / minBaths: minimums only (integers; baths may be 1, 2, 2.5).
- propertyType: only when clear — use one of: Residential, Condo, Townhouse, Land, Multi-Family. Otherwise null.
- sort: only if the user asks (cheapest → price_asc, newest → newest, largest → sqft_desc). Otherwise null.
- softPrefs: short amenity/lifestyle phrases that appear in MLS remarks (pool, garage, farmhouse, modern, quiet, fenced yard, waterfront, basement, hardwood, chef's kitchen, etc.). Max 8. Do NOT put location or price here. Prefer canonical short labels.
- summary: one friendly sentence describing filters + soft wants.
- Do not invent a location. If none given, q is null.
- Ignore non-housing requests; still return the JSON schema with nulls and empty softPrefs.`;

function positiveNum(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function optionalString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

const SORTS = new Set(["price_asc", "price_desc", "newest", "sqft_desc"]);

function normalizeIntent(raw: Record<string, unknown>): DreamHomeIntent {
  const sortRaw = optionalString(raw.sort);
  const sort =
    sortRaw && SORTS.has(sortRaw) ? (sortRaw as DreamHomeHardFilters["sort"]) : undefined;

  const softRaw = Array.isArray(raw.softPrefs) ? raw.softPrefs : [];
  const softPrefs = softRaw
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 8);

  const filters: DreamHomeHardFilters = {};
  const q = optionalString(raw.q);
  if (q) filters.q = q;
  const minPrice = positiveNum(raw.minPrice);
  if (minPrice != null) filters.minPrice = Math.round(minPrice);
  const maxPrice = positiveNum(raw.maxPrice);
  if (maxPrice != null) filters.maxPrice = Math.round(maxPrice);
  const minBeds = positiveNum(raw.minBeds);
  if (minBeds != null) filters.minBeds = Math.floor(minBeds);
  const minBaths = positiveNum(raw.minBaths);
  if (minBaths != null) filters.minBaths = minBaths;
  const minSqft = positiveNum(raw.minSqft);
  if (minSqft != null) filters.minSqft = Math.floor(minSqft);
  const maxSqft = positiveNum(raw.maxSqft);
  if (maxSqft != null) filters.maxSqft = Math.floor(maxSqft);
  const propertyType = optionalString(raw.propertyType);
  if (propertyType) filters.propertyType = propertyType;
  if (sort) filters.sort = sort;

  const summary =
    optionalString(raw.summary) ??
    "We mapped your description into searchable filters. You can edit the chips below.";

  const { amenities, remainingSoft } = softPrefsToAmenities(softPrefs);
  return { filters, softPrefs: remainingSoft, amenities, summary };
}

/** Merge LLM + heuristic extracts — fill gaps, union soft prefs, prefer specific location. */
export function mergeDreamIntent(
  llm: DreamHomeIntent,
  prompt: string,
): DreamHomeIntent {
  const h = heuristicDreamExtract(prompt);
  const gaLoc = detectGaLocationInText(prompt);

  const filters: DreamHomeHardFilters = { ...llm.filters };

  if (!filters.q) {
    if (gaLoc) filters.q = gaLoc;
    // heuristic doesn't set q — GA detector covers cities
  } else if (gaLoc && filters.q.length < gaLoc.length && gaLoc.toLowerCase().includes(filters.q.toLowerCase())) {
    filters.q = gaLoc;
  }

  if (filters.minPrice == null && h.minPrice != null) filters.minPrice = h.minPrice;
  if (filters.maxPrice == null && h.maxPrice != null) filters.maxPrice = h.maxPrice;
  if (filters.minBeds == null && h.minBeds != null) filters.minBeds = h.minBeds;
  if (filters.minBaths == null && h.minBaths != null) filters.minBaths = h.minBaths;
  if (filters.minSqft == null && h.minSqft != null) filters.minSqft = h.minSqft;
  if (filters.maxSqft == null && h.maxSqft != null) filters.maxSqft = h.maxSqft;
  if (!filters.propertyType && h.propertyType) filters.propertyType = h.propertyType;

  const softPrefs = Array.from(
    new Set(
      [...llm.softPrefs, ...h.softPrefs].map((s) => s.trim()).filter(Boolean),
    ),
  ).slice(0, 8);

  const { amenities, remainingSoft } = softPrefsToAmenities(softPrefs);

  let summary = llm.summary;
  const amenityBits: string[] = [];
  if (amenities.hasPool) amenityBits.push("pool");
  if (amenities.minGarageSpaces) amenityBits.push("garage");
  if (amenities.hasFireplace) amenityBits.push("fireplace");
  if (amenities.hasWaterfront) amenityBits.push("waterfront");
  if (amenities.maxStories === 1) amenityBits.push("ranch / 1-story");
  if (amenities.minAcres) amenityBits.push(`${amenities.minAcres}+ acres`);
  if (amenities.noHoa) amenityBits.push("no HOA");
  if (amenities.minYearBuilt) amenityBits.push(`built ${amenities.minYearBuilt}+`);

  if (amenityBits.length && !/pool|garage|amenity|filter/i.test(summary)) {
    summary = `${summary} Applying MLS filters for: ${amenityBits.join(", ")}.`;
  } else if (remainingSoft.length && !/pool|garage|match|prefer|want/i.test(summary)) {
    summary = `${summary} We'll boost homes whose listings mention: ${remainingSoft.join(", ")}.`;
  }

  return { filters, softPrefs: remainingSoft, amenities, summary };
}

export async function parseDreamHomeIntent(prompt: string): Promise<DreamHomeIntent> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Buyer's description:\n\n${prompt}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 700,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Could not parse dream-home intent JSON");
  }

  return mergeDreamIntent(normalizeIntent(parsed), prompt);
}

/**
 * Offline / API-down fallback — heuristics only so dream search still works.
 */
export function parseDreamHomeIntentHeuristicOnly(prompt: string): DreamHomeIntent {
  const h = heuristicDreamExtract(prompt);
  const gaLoc = detectGaLocationInText(prompt);
  const filters: DreamHomeHardFilters = {};
  if (gaLoc) filters.q = gaLoc;
  if (h.minPrice != null) filters.minPrice = h.minPrice;
  if (h.maxPrice != null) filters.maxPrice = h.maxPrice;
  if (h.minBeds != null) filters.minBeds = h.minBeds;
  if (h.minBaths != null) filters.minBaths = h.minBaths;
  if (h.minSqft != null) filters.minSqft = h.minSqft;
  if (h.maxSqft != null) filters.maxSqft = h.maxSqft;
  if (h.propertyType) filters.propertyType = h.propertyType;

  const softPrefs = h.softPrefs;
  const { amenities, remainingSoft } = softPrefsToAmenities(softPrefs);
  const bits: string[] = [];
  if (filters.q) bits.push(filters.q);
  if (filters.maxPrice) bits.push(`up to $${Math.round(filters.maxPrice / 1000)}k`);
  if (filters.minBeds) bits.push(`${filters.minBeds}+ beds`);
  if (amenities.hasPool) bits.push("pool");
  if (amenities.minGarageSpaces) bits.push("garage");
  if (remainingSoft.length) bits.push(`preferring ${remainingSoft.join(", ")}`);

  return {
    filters,
    softPrefs: remainingSoft,
    amenities,
    summary: bits.length
      ? `Searching ${bits.join(" · ")}.`
      : "We used keyword matching from your description.",
  };
}

/** Encode hard filters (+ optional dream/soft) into listings URL search params. */
export function dreamIntentToSearchParams(
  intent: DreamHomeIntent,
  options?: { dreamText?: string; view?: string },
): URLSearchParams {
  const p = new URLSearchParams();
  const f = intent.filters;
  if (f.q) p.set("q", f.q);
  if (f.minPrice != null) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) p.set("maxPrice", String(f.maxPrice));
  if (f.minBeds != null) p.set("minBeds", String(f.minBeds));
  if (f.minBaths != null) p.set("minBaths", String(f.minBaths));
  if (f.minSqft != null) p.set("minSqft", String(f.minSqft));
  if (f.maxSqft != null) p.set("maxSqft", String(f.maxSqft));
  if (f.propertyType) p.set("propertyType", f.propertyType);
  if (f.sort && f.sort !== "price_desc") p.set("sort", f.sort);
  writeAmenitiesToSearchParams(p, intent.amenities ?? {});
  if (options?.dreamText?.trim()) p.set("dream", options.dreamText.trim().slice(0, 500));
  if (intent.softPrefs.length > 0) p.set("soft", intent.softPrefs.join("|"));
  if (options?.view && options.view !== "list") p.set("view", options.view);
  return p;
}

export type DreamChipKind = "hard" | "soft";

export type DreamChip = {
  id: string;
  /** URL param key for hard chips; soft chips use "soft" + index via softPrefs list. */
  param: string;
  label: string;
  kind: DreamChipKind;
  /** Soft chip index into the soft prefs list (for removal). */
  softIndex?: number;
};

function formatPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) ? `$${m}M` : `$${m.toFixed(1)}M`;
  }
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

/** Build editable chip models from current listings URL params. */
export function dreamChipsFromSearchParams(params: {
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  minBeds?: string;
  minBaths?: string;
  minSqft?: string;
  maxSqft?: string;
  propertyType?: string;
  soft?: string;
  pool?: string;
  garage?: string;
  fireplace?: string;
  waterfront?: string;
  minYear?: string;
  maxYear?: string;
  maxStories?: string;
  minAcres?: string;
  noHoa?: string;
}): DreamChip[] {
  const chips: DreamChip[] = [];

  if (params.q) {
    chips.push({ id: "q", param: "q", label: params.q, kind: "hard" });
  }
  if (params.minPrice) {
    const n = Number(params.minPrice);
    chips.push({
      id: "minPrice",
      param: "minPrice",
      label: Number.isFinite(n) ? `From ${formatPrice(n)}` : `Min $${params.minPrice}`,
      kind: "hard",
    });
  }
  if (params.maxPrice) {
    const n = Number(params.maxPrice);
    chips.push({
      id: "maxPrice",
      param: "maxPrice",
      label: Number.isFinite(n) ? `Up to ${formatPrice(n)}` : `Max $${params.maxPrice}`,
      kind: "hard",
    });
  }
  if (params.minBeds) {
    chips.push({
      id: "minBeds",
      param: "minBeds",
      label: `${params.minBeds}+ beds`,
      kind: "hard",
    });
  }
  if (params.minBaths) {
    chips.push({
      id: "minBaths",
      param: "minBaths",
      label: `${params.minBaths}+ baths`,
      kind: "hard",
    });
  }
  if (params.minSqft) {
    chips.push({
      id: "minSqft",
      param: "minSqft",
      label: `${Number(params.minSqft).toLocaleString()}+ sqft`,
      kind: "hard",
    });
  }
  if (params.maxSqft) {
    chips.push({
      id: "maxSqft",
      param: "maxSqft",
      label: `≤ ${Number(params.maxSqft).toLocaleString()} sqft`,
      kind: "hard",
    });
  }
  if (params.propertyType) {
    chips.push({
      id: "propertyType",
      param: "propertyType",
      label: params.propertyType,
      kind: "hard",
    });
  }

  for (const a of amenityChipsFromParams({
    ...(params.pool ? { pool: params.pool } : {}),
    ...(params.garage ? { garage: params.garage } : {}),
    ...(params.fireplace ? { fireplace: params.fireplace } : {}),
    ...(params.waterfront ? { waterfront: params.waterfront } : {}),
    ...(params.minYear ? { minYear: params.minYear } : {}),
    ...(params.maxYear ? { maxYear: params.maxYear } : {}),
    ...(params.maxStories ? { maxStories: params.maxStories } : {}),
    ...(params.minAcres ? { minAcres: params.minAcres } : {}),
    ...(params.noHoa ? { noHoa: params.noHoa } : {}),
  })) {
    chips.push({
      id: a.id,
      param: a.param,
      label: a.label,
      kind: "hard",
    });
  }

  const softList = (params.soft ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  softList.forEach((label, softIndex) => {
    chips.push({
      id: `soft-${softIndex}`,
      param: "soft",
      label,
      kind: "soft",
      softIndex,
    });
  });

  return chips;
}
