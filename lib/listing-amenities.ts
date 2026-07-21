/**
 * Amenity hard-filters for dream / listings search.
 * Maps buyer language → RESO fields and builds OData / URL params.
 */

import type { ListingFilters } from "@/lib/listings-queries";

/** Structured amenity constraints (URL + ListingFilters). */
export type ListingAmenities = {
  hasPool?: boolean;
  /** Minimum garage spaces (typically 1). */
  minGarageSpaces?: number;
  hasFireplace?: boolean;
  hasWaterfront?: boolean;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  /** Single-story / ranch — StoriesTotal / Stories ≤ this (usually 1). */
  maxStories?: number;
  minAcres?: number;
  noHoa?: boolean;
};

export type AmenityFeed = "bridge" | "spark";

/** Soft-pref labels that promote to hard amenity filters. */
const SOFT_TO_AMENITY: Array<{
  match: RegExp;
  apply: (a: ListingAmenities) => void;
  /** Canonical soft label to keep for keyword ranking when hard filter is unavailable / loosened. */
  keepSoft?: string;
}> = [
  {
    match: /\bpool\b/,
    apply: (a) => {
      a.hasPool = true;
    },
    keepSoft: "pool",
  },
  {
    match: /\b(spa|hot tub|jacuzzi)\b/,
    apply: () => {
      /* spa stays soft-only for now */
    },
    keepSoft: "spa",
  },
  {
    match: /\bgarage\b/,
    apply: (a) => {
      a.minGarageSpaces = Math.max(a.minGarageSpaces ?? 0, 1);
    },
    keepSoft: "garage",
  },
  {
    match: /\bfireplace\b/,
    apply: (a) => {
      a.hasFireplace = true;
    },
    keepSoft: "fireplace",
  },
  {
    match: /\b(waterfront|lakefront|lake front|riverfront)\b/,
    apply: (a) => {
      a.hasWaterfront = true;
    },
    keepSoft: "waterfront",
  },
  {
    match: /\b(ranch|single[-\s]?story|one story|1 story)\b/,
    apply: (a) => {
      a.maxStories = 1;
    },
    keepSoft: "ranch",
  },
  {
    match: /\b(new construction|newly built|brand new)\b/,
    apply: (a) => {
      const y = new Date().getFullYear() - 2;
      a.minYearBuilt = Math.max(a.minYearBuilt ?? 0, y);
    },
    keepSoft: "new construction",
  },
  {
    match: /\b(acreage|acres?)\b/,
    apply: (a) => {
      if (a.minAcres == null) a.minAcres = 1;
    },
    keepSoft: "acreage",
  },
  {
    match: /\b(hoa[-\s]?free|no hoa|without hoa|zero hoa)\b/,
    apply: (a) => {
      a.noHoa = true;
    },
  },
];

/** Promote matching soft prefs into hard amenity flags; return leftover soft prefs for ranking. */
export function softPrefsToAmenities(softPrefs: string[]): {
  amenities: ListingAmenities;
  remainingSoft: string[];
} {
  const amenities: ListingAmenities = {};
  const remainingSoft: string[] = [];
  const used = new Set<string>();

  for (const pref of softPrefs) {
    const n = pref.toLowerCase().trim();
    if (!n) continue;
    let promoted = false;
    for (const rule of SOFT_TO_AMENITY) {
      if (rule.match.test(n)) {
        rule.apply(amenities);
        promoted = true;
        if (rule.keepSoft) used.add(rule.keepSoft);
        break;
      }
    }
    if (!promoted) remainingSoft.push(pref);
  }

  // Keep promoted labels as soft too — keyword boost when hard filter is loosened / sparse.
  for (const label of used) {
    if (!remainingSoft.some((s) => s.toLowerCase() === label)) {
      remainingSoft.push(label);
    }
  }

  return { amenities, remainingSoft: remainingSoft.slice(0, 8) };
}

export function amenitiesFromListingFilters(filters: ListingFilters): ListingAmenities {
  const a: ListingAmenities = {};
  if (filters.hasPool) a.hasPool = true;
  if (filters.minGarageSpaces != null && filters.minGarageSpaces > 0) {
    a.minGarageSpaces = filters.minGarageSpaces;
  }
  if (filters.hasFireplace) a.hasFireplace = true;
  if (filters.hasWaterfront) a.hasWaterfront = true;
  if (filters.minYearBuilt != null) a.minYearBuilt = filters.minYearBuilt;
  if (filters.maxYearBuilt != null) a.maxYearBuilt = filters.maxYearBuilt;
  if (filters.maxStories != null) a.maxStories = filters.maxStories;
  if (filters.minAcres != null) a.minAcres = filters.minAcres;
  if (filters.noHoa) a.noHoa = true;
  return a;
}

export function listingFiltersHaveAmenities(filters: ListingFilters): boolean {
  const a = amenitiesFromListingFilters(filters);
  return (
    !!a.hasPool ||
    (a.minGarageSpaces != null && a.minGarageSpaces > 0) ||
    !!a.hasFireplace ||
    !!a.hasWaterfront ||
    a.minYearBuilt != null ||
    a.maxYearBuilt != null ||
    a.maxStories != null ||
    a.minAcres != null ||
    !!a.noHoa
  );
}

export function stripAmenitiesFromFilters(filters: ListingFilters): ListingFilters {
  const {
    hasPool: _p,
    minGarageSpaces: _g,
    hasFireplace: _f,
    hasWaterfront: _w,
    minYearBuilt: _miny,
    maxYearBuilt: _maxy,
    maxStories: _s,
    minAcres: _a,
    noHoa: _h,
    ...rest
  } = filters;
  return rest;
}

export function applyAmenitiesToFilters(
  filters: ListingFilters,
  amenities: ListingAmenities,
): ListingFilters {
  const out: ListingFilters = { ...filters };
  if (amenities.hasPool) out.hasPool = true;
  if (amenities.minGarageSpaces != null && amenities.minGarageSpaces > 0) {
    out.minGarageSpaces = amenities.minGarageSpaces;
  }
  if (amenities.hasFireplace) out.hasFireplace = true;
  if (amenities.hasWaterfront) out.hasWaterfront = true;
  if (amenities.minYearBuilt != null) out.minYearBuilt = amenities.minYearBuilt;
  if (amenities.maxYearBuilt != null) out.maxYearBuilt = amenities.maxYearBuilt;
  if (amenities.maxStories != null) out.maxStories = amenities.maxStories;
  if (amenities.minAcres != null) out.minAcres = amenities.minAcres;
  if (amenities.noHoa) out.noHoa = true;
  return out;
}

/** Encode amenities into URL search params. */
export function writeAmenitiesToSearchParams(
  p: URLSearchParams,
  amenities: ListingAmenities,
): void {
  if (amenities.hasPool) p.set("pool", "1");
  if (amenities.minGarageSpaces != null && amenities.minGarageSpaces > 0) {
    p.set("garage", String(amenities.minGarageSpaces));
  }
  if (amenities.hasFireplace) p.set("fireplace", "1");
  if (amenities.hasWaterfront) p.set("waterfront", "1");
  if (amenities.minYearBuilt != null) p.set("minYear", String(amenities.minYearBuilt));
  if (amenities.maxYearBuilt != null) p.set("maxYear", String(amenities.maxYearBuilt));
  if (amenities.maxStories != null) p.set("maxStories", String(amenities.maxStories));
  if (amenities.minAcres != null) p.set("minAcres", String(amenities.minAcres));
  if (amenities.noHoa) p.set("noHoa", "1");
}

/** Parse amenity URL params into ListingAmenities. */
export function parseAmenitiesFromSearchParams(params: {
  pool?: string | null;
  garage?: string | null;
  fireplace?: string | null;
  waterfront?: string | null;
  minYear?: string | null;
  maxYear?: string | null;
  maxStories?: string | null;
  minAcres?: string | null;
  noHoa?: string | null;
}): ListingAmenities {
  const a: ListingAmenities = {};
  if (params.pool === "1" || params.pool === "true") a.hasPool = true;
  if (params.garage) {
    const n = Number(params.garage);
    if (Number.isFinite(n) && n > 0) a.minGarageSpaces = Math.floor(n);
  }
  if (params.fireplace === "1" || params.fireplace === "true") a.hasFireplace = true;
  if (params.waterfront === "1" || params.waterfront === "true") a.hasWaterfront = true;
  if (params.minYear) {
    const n = Number(params.minYear);
    if (Number.isFinite(n) && n > 1800) a.minYearBuilt = Math.floor(n);
  }
  if (params.maxYear) {
    const n = Number(params.maxYear);
    if (Number.isFinite(n) && n > 1800) a.maxYearBuilt = Math.floor(n);
  }
  if (params.maxStories) {
    const n = Number(params.maxStories);
    if (Number.isFinite(n) && n > 0) a.maxStories = Math.floor(n);
  }
  if (params.minAcres) {
    const n = Number(params.minAcres);
    if (Number.isFinite(n) && n > 0) a.minAcres = n;
  }
  if (params.noHoa === "1" || params.noHoa === "true") a.noHoa = true;
  return a;
}

function ynClause(field: string): string {
  // Boolean + Y/N string forms — works across Bridge IDX and Spark.
  return `((${field} eq true) or (${field} eq 'Y') or (${field} eq 'y'))`;
}

function ynFalseOrMissingClause(field: string): string {
  return `((${field} eq false) or (${field} eq 'N') or (${field} eq 'n') or (${field} eq null))`;
}

/**
 * Build AND-able OData fragments for amenities.
 * `enabled` gates which amenity keys to emit (from feed capability / probe).
 */
export function buildAmenityODataClauses(
  amenities: ListingAmenities,
  feed: AmenityFeed,
  enabled: ReadonlySet<string>,
): string[] {
  const parts: string[] = [];

  if (amenities.hasPool && enabled.has("hasPool")) {
    parts.push(ynClause("PoolPrivateYN"));
  }
  if (
    amenities.minGarageSpaces != null &&
    amenities.minGarageSpaces > 0 &&
    enabled.has("minGarageSpaces")
  ) {
    parts.push(`GarageSpaces ge ${Math.floor(amenities.minGarageSpaces)}`);
  }
  if (amenities.hasFireplace && enabled.has("hasFireplace")) {
    parts.push(
      `((FireplacesTotal ge 1) or (FireplaceYN eq true) or (FireplaceYN eq 'Y') or (FireplaceYN eq 'y'))`,
    );
  }
  if (amenities.hasWaterfront && enabled.has("hasWaterfront")) {
    parts.push(ynClause("WaterfrontYN"));
  }
  if (amenities.minYearBuilt != null && enabled.has("minYearBuilt")) {
    parts.push(`YearBuilt ge ${Math.floor(amenities.minYearBuilt)}`);
  }
  if (amenities.maxYearBuilt != null && enabled.has("maxYearBuilt")) {
    parts.push(`YearBuilt le ${Math.floor(amenities.maxYearBuilt)}`);
  }
  if (amenities.maxStories != null && enabled.has("maxStories")) {
    const s = Math.floor(amenities.maxStories);
    if (feed === "spark") {
      parts.push(
        `((StoriesTotal le ${s}) or (Stories le ${s}) or (Levels eq 'One') or (Levels eq '1'))`,
      );
    } else {
      // Avoid contains(tolower(...)) on Levels — some IDX feeds reject it.
      parts.push(`((StoriesTotal le ${s}) or (Stories le ${s}))`);
    }
  }
  if (amenities.minAcres != null && enabled.has("minAcres")) {
    parts.push(`LotSizeAcres ge ${amenities.minAcres}`);
  }
  if (amenities.noHoa && enabled.has("noHoa")) {
    parts.push(
      `(${ynFalseOrMissingClause("AssociationYN")} or (AssociationFee eq 0) or (AssociationFee eq null))`,
    );
  }

  return parts;
}

/** When hard amenity filters are loosened, keep these as soft ranking prefs. */
export function amenitiesToSoftPrefs(amenities: ListingAmenities): string[] {
  const out: string[] = [];
  if (amenities.hasPool) out.push("pool");
  if (amenities.minGarageSpaces != null && amenities.minGarageSpaces > 0) out.push("garage");
  if (amenities.hasFireplace) out.push("fireplace");
  if (amenities.hasWaterfront) out.push("waterfront");
  if (amenities.maxStories === 1) out.push("ranch");
  if (amenities.minYearBuilt != null && amenities.minYearBuilt >= new Date().getFullYear() - 5) {
    out.push("new construction");
  }
  if (amenities.minAcres != null) out.push("acreage");
  if (amenities.noHoa) out.push("HOA-free");
  return out;
}

/** Chip models for amenity URL params. */
export type AmenityChip = {
  id: string;
  param: string;
  label: string;
};

export function amenityChipsFromParams(params: {
  pool?: string;
  garage?: string;
  fireplace?: string;
  waterfront?: string;
  minYear?: string;
  maxYear?: string;
  maxStories?: string;
  minAcres?: string;
  noHoa?: string;
}): AmenityChip[] {
  const chips: AmenityChip[] = [];
  if (params.pool === "1") chips.push({ id: "pool", param: "pool", label: "Pool" });
  if (params.garage) {
    chips.push({
      id: "garage",
      param: "garage",
      label: `${params.garage}+ car garage`,
    });
  }
  if (params.fireplace === "1") {
    chips.push({ id: "fireplace", param: "fireplace", label: "Fireplace" });
  }
  if (params.waterfront === "1") {
    chips.push({ id: "waterfront", param: "waterfront", label: "Waterfront" });
  }
  if (params.minYear) {
    chips.push({ id: "minYear", param: "minYear", label: `Built ${params.minYear}+` });
  }
  if (params.maxYear) {
    chips.push({ id: "maxYear", param: "maxYear", label: `Built ≤${params.maxYear}` });
  }
  if (params.maxStories === "1") {
    chips.push({ id: "maxStories", param: "maxStories", label: "1 story / ranch" });
  } else if (params.maxStories) {
    chips.push({
      id: "maxStories",
      param: "maxStories",
      label: `≤${params.maxStories} stories`,
    });
  }
  if (params.minAcres) {
    chips.push({ id: "minAcres", param: "minAcres", label: `${params.minAcres}+ acres` });
  }
  if (params.noHoa === "1") chips.push({ id: "noHoa", param: "noHoa", label: "No HOA" });
  return chips;
}
