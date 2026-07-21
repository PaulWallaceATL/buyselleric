/**
 * Dream-home keyword matching — expands buyer soft prefs into synonym terms
 * and scores listing text so “pool / garage / modern” actually move homes up.
 */

export type DreamMatchTerm = {
  /** Canonical label shown in chips */
  label: string;
  /** Synonyms / phrases to look for in listing copy */
  terms: string[];
  weight: number;
};

/** Known amenity / lifestyle lexicon (Georgia MLS remarks language). */
const LEXICON: DreamMatchTerm[] = [
  {
    label: "pool",
    terms: ["pool", "swimming pool", "in-ground pool", "inground pool", "gunite", "saltwater pool"],
    weight: 4,
  },
  {
    label: "spa",
    terms: ["spa", "hot tub", "jacuzzi"],
    weight: 3,
  },
  {
    label: "garage",
    terms: ["garage", "2-car garage", "2 car garage", "3-car garage", "attached garage", "detached garage", "garage spaces"],
    weight: 3,
  },
  {
    label: "fireplace",
    terms: ["fireplace", "fire place", "wood burning", "gas log"],
    weight: 2,
  },
  {
    label: "fenced yard",
    terms: ["fenced", "fence", "fenced yard", "privacy fence"],
    weight: 2,
  },
  {
    label: "waterfront",
    terms: ["waterfront", "lake front", "lakefront", "riverfront", "on the lake", "lake view", "water view"],
    weight: 4,
  },
  {
    label: "basement",
    terms: ["basement", "finished basement", "full basement", "terrace level"],
    weight: 3,
  },
  {
    label: "ranch",
    terms: ["ranch", "one story", "1 story", "single story", "single-story"],
    weight: 2,
  },
  {
    label: "modern",
    terms: ["modern", "contemporary", "open concept", "open floor plan", "minimalist"],
    weight: 2,
  },
  {
    label: "farmhouse",
    terms: ["farmhouse", "modern farmhouse", "shiplap", "barn door"],
    weight: 2,
  },
  {
    label: "updated",
    terms: ["updated", "renovated", "remodel", "remodeled", "newly updated", "freshly painted"],
    weight: 2,
  },
  {
    label: "new construction",
    terms: ["new construction", "newly built", "to-be-built", "never lived in", "brand new"],
    weight: 3,
  },
  {
    label: "hardwood",
    terms: ["hardwood", "hardwood floors", "hardwood flooring", "engineered hardwood"],
    weight: 1,
  },
  {
    label: "chef's kitchen",
    terms: ["chef's kitchen", "gourmet kitchen", "quartz", "granite counters", "island kitchen", "kitchen island"],
    weight: 2,
  },
  {
    label: "workshop",
    terms: ["workshop", "shop", "outbuilding", "barn", "detached shop"],
    weight: 2,
  },
  {
    label: "acreage",
    terms: ["acre", "acres", "acreage", "large lot", "private lot"],
    weight: 2,
  },
  {
    label: "quiet",
    terms: ["quiet", "cul-de-sac", "cul de sac", "peaceful", "private"],
    weight: 1,
  },
  {
    label: "HOA-free",
    terms: ["no hoa", "no h.o.a", "hoa free", "without hoa", "zero hoa"],
    weight: 2,
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s+']/g, " ").replace(/\s+/g, " ").trim();
}

/** Map a free-text soft preference onto lexicon entry or keep as raw terms. */
export function expandSoftPref(pref: string): DreamMatchTerm {
  const n = normalize(pref);
  if (!n) return { label: pref.trim(), terms: [pref.trim().toLowerCase()], weight: 1 };

  for (const entry of LEXICON) {
    if (entry.label === n || entry.terms.some((t) => n === t || n.includes(t) || t.includes(n))) {
      return entry;
    }
  }

  // Multi-word → keep phrase + tokens
  const tokens = n.split(" ").filter((t) => t.length > 2);
  return {
    label: pref.trim(),
    terms: Array.from(new Set([n, ...tokens])),
    weight: 1,
  };
}

/** Expand chip labels into a flat list of match terms (deduped). */
export function expandSoftPrefsToMatchTerms(softPrefs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const pref of softPrefs) {
    const expanded = expandSoftPref(pref);
    for (const t of expanded.terms) {
      const key = normalize(t);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out.slice(0, 24);
}

export type DreamMatchScore = {
  score: number;
  matchedLabels: string[];
};

/** Score haystack text against soft preference labels (uses lexicon weights). */
export function scoreDreamMatch(haystack: string, softPrefs: string[]): DreamMatchScore {
  if (!softPrefs.length || !haystack.trim()) return { score: 0, matchedLabels: [] };
  const hay = normalize(haystack);
  if (!hay) return { score: 0, matchedLabels: [] };

  let score = 0;
  const matchedLabels: string[] = [];

  for (const pref of softPrefs) {
    const entry = expandSoftPref(pref);
    const hit = entry.terms.some((t) => {
      const term = normalize(t);
      if (!term) return false;
      if (term.includes(" ")) return hay.includes(term);
      // word-ish boundary for short tokens
      return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:\\s|$)`).test(hay) || hay.includes(term);
    });
    if (hit) {
      score += entry.weight;
      matchedLabels.push(entry.label);
    }
  }

  return { score, matchedLabels };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect common hard filters from raw buyer text (runs even if the LLM misses).
 */
export function heuristicDreamExtract(text: string): {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyType?: string;
  softPrefs: string[];
} {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const softPrefs: string[] = [];

  for (const entry of LEXICON) {
    if (entry.terms.some((t) => lower.includes(t))) {
      softPrefs.push(entry.label);
    }
  }

  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const under = lower.match(
    /(?:under|below|max(?:imum)?|up to|no more than|budget(?:\s+of)?|less than)\s*\$?\s*([\d.,]+)\s*(k|m|million)?/i,
  );
  if (under) {
    maxPrice = parseMoneyToken(under[1], under[2]);
  }
  const around = lower.match(/(?:around|about|near|~)\s*\$?\s*([\d.,]+)\s*(k|m|million)?/i);
  if (around && maxPrice == null) {
    const mid = parseMoneyToken(around[1], around[2]);
    if (mid != null) {
      minPrice = Math.round(mid * 0.85);
      maxPrice = Math.round(mid * 1.15);
    }
  }
  const between = lower.match(
    /(?:between|from)\s*\$?\s*([\d.,]+)\s*(k|m)?\s*(?:and|to|-)\s*\$?\s*([\d.,]+)\s*(k|m|million)?/i,
  );
  if (between) {
    minPrice = parseMoneyToken(between[1], between[2]);
    maxPrice = parseMoneyToken(between[3], between[4]);
  }
  const bareMoney = lower.match(/\$\s*([\d.,]+)\s*(k|m|million)?/);
  if (bareMoney && maxPrice == null && minPrice == null) {
    maxPrice = parseMoneyToken(bareMoney[1], bareMoney[2]);
  }

  let minBeds: number | undefined;
  const beds = lower.match(/(\d+)\s*\+?\s*(?:bed(?:room)?s?|br)\b/);
  if (beds) minBeds = Number(beds[1]);

  let minBaths: number | undefined;
  const baths = lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:bath(?:room)?s?|ba)\b/);
  if (baths) minBaths = Number(baths[1]);

  let minSqft: number | undefined;
  let maxSqft: number | undefined;
  const sqftMin = lower.match(/(?:at least|over|more than|min(?:imum)?)\s*([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)/);
  if (sqftMin?.[1]) minSqft = Number(sqftMin[1].replace(/,/g, ""));
  const sqftMax = lower.match(/(?:under|below|less than|max)\s*([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)/);
  if (sqftMax?.[1]) maxSqft = Number(sqftMax[1].replace(/,/g, ""));
  const sqftBare = lower.match(/([\d,]+)\s*(?:\+|plus)?\s*(?:sq\.?\s*ft|sqft|square feet)/);
  if (sqftBare?.[1] && minSqft == null && maxSqft == null) {
    minSqft = Number(sqftBare[1].replace(/,/g, ""));
  }

  let propertyType: string | undefined;
  if (/\bcondo/.test(lower)) propertyType = "Condo";
  else if (/\btown\s*-?\s*home|\btownhouse/.test(lower)) propertyType = "Townhouse";
  else if (/\bland\b|\blot\b|\bacreage for sale/.test(lower)) propertyType = "Land";
  else if (/\bmulti[-\s]?family|\bduplex|\btriplex/.test(lower)) propertyType = "Multi-Family";
  else if (/\bsingle[-\s]?family|\bhouse\b|\bhome\b/.test(lower)) propertyType = "Residential";

  return {
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(minBeds != null ? { minBeds } : {}),
    ...(minBaths != null ? { minBaths } : {}),
    ...(minSqft != null ? { minSqft } : {}),
    ...(maxSqft != null ? { maxSqft } : {}),
    ...(propertyType ? { propertyType } : {}),
    softPrefs: Array.from(new Set(softPrefs)).slice(0, 8),
  };
}

function parseMoneyToken(numRaw: string | undefined, suffix: string | undefined): number | undefined {
  if (!numRaw) return undefined;
  const n = Number(String(numRaw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const s = (suffix ?? "").toLowerCase();
  if (s === "m" || s === "million") return Math.round(n * 1_000_000);
  if (s === "k") return Math.round(n * 1000);
  // bare "450" in real-estate talk usually means $450k when < 10000
  if (!s && n < 10_000) return Math.round(n * 1000);
  return Math.round(n);
}
