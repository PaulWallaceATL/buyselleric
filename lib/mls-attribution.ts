import type { MlsListingRow } from "@/lib/types/db";

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Older synced rows stuffed office phone into `listing_office` as `Name · phone`. */
function splitNamePhone(combined: string): { name: string; phone: string } {
  const t = combined.trim();
  if (!t) return { name: "", phone: "" };
  const sep = " · ";
  const i = t.indexOf(sep);
  if (i === -1) return { name: t, phone: "" };
  return { name: t.slice(0, i).trim(), phone: t.slice(i + sep.length).trim() };
}

/**
 * Resolve display attribution from mapped columns + raw RESO payload.
 * GAMLS often omits agent/office on $select; raw_data / first-last fields still help.
 */
export function resolveMlsAttribution(listing: MlsListingRow): {
  listing_agent: string;
  listing_agent_phone: string;
  listing_office: string;
  listing_office_phone: string;
} {
  const raw = listing.raw_data ?? {};

  const listAgentFirstLast = [str(raw.ListAgentFirstName), str(raw.ListAgentLastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const coFirstLast = [str(raw.CoListAgentFirstName), str(raw.CoListAgentLastName)]
    .filter(Boolean)
    .join(" ")
    .trim();

  let listing_agent =
    listing.listing_agent ||
    str(raw.ListAgentFullName) ||
    str(raw.ListAgent) ||
    listAgentFirstLast ||
    str(raw.CoListAgentFullName) ||
    str(raw.CoListAgent) ||
    coFirstLast;

  let listing_agent_phone =
    listing.listing_agent_phone ||
    str(raw.ListAgentPreferredPhone) ||
    str(raw.ListAgentDirectPhone) ||
    str(raw.ListAgentCellPhone) ||
    str(raw.ListAgentMobilePhone) ||
    str(raw.ListAgentOfficePhone) ||
    str(raw.ListAgentPhone);

  let listing_office =
    listing.listing_office ||
    str(raw.ListOfficeName) ||
    str(raw.ListOffice) ||
    str(raw.ListCompany) ||
    str(raw.ListBrokerageName);

  let listing_office_phone =
    listing.listing_office_phone || str(raw.ListOfficePhone) || str(raw.ListOfficeFax);

  // Legacy combined office column
  if (listing_office && !listing_office_phone && listing_office.includes(" · ")) {
    const split = splitNamePhone(listing_office);
    listing_office = split.name;
    listing_office_phone = split.phone;
  }

  return {
    listing_agent,
    listing_agent_phone,
    listing_office,
    listing_office_phone,
  };
}

export function hasMlsAttribution(listing: MlsListingRow): boolean {
  const a = resolveMlsAttribution(listing);
  return Boolean(
    a.listing_agent || a.listing_agent_phone || a.listing_office || a.listing_office_phone,
  );
}

/** Score completeness so we can prefer a live/enriched row over a sparse cache hit. */
export function scoreMlsListingCompleteness(row: MlsListingRow): number {
  const a = resolveMlsAttribution(row);
  let s = 0;
  const photos = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean).length : 0;
  s += Math.min(photos, 30) * 2;
  if (row.description && row.description.length > 40) s += 8;
  if (a.listing_agent) s += 20;
  if (a.listing_office) s += 20;
  if (a.listing_agent_phone) s += 8;
  if (a.listing_office_phone) s += 8;
  return s;
}

/** Merge multiple feed/cache hits into the richest single listing. */
export function mergeMlsListingRows(rows: MlsListingRow[]): MlsListingRow | null {
  const usable = rows.filter(Boolean);
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0]!;

  const ranked = [...usable].sort(
    (a, b) => scoreMlsListingCompleteness(b) - scoreMlsListingCompleteness(a),
  );
  const best = { ...ranked[0]! };

  for (const row of ranked.slice(1)) {
    const ba = resolveMlsAttribution(best);
    const ra = resolveMlsAttribution(row);
    if (!ba.listing_agent && ra.listing_agent) best.listing_agent = ra.listing_agent;
    if (!ba.listing_agent_phone && ra.listing_agent_phone) {
      best.listing_agent_phone = ra.listing_agent_phone;
    }
    if (!ba.listing_office && ra.listing_office) best.listing_office = ra.listing_office;
    if (!ba.listing_office_phone && ra.listing_office_phone) {
      best.listing_office_phone = ra.listing_office_phone;
    }
    if ((!best.description || best.description.length < 40) && row.description) {
      best.description = row.description;
    }
    if ((best.image_urls?.length ?? 0) < (row.image_urls?.length ?? 0)) {
      best.image_urls = row.image_urls;
    }
    best.raw_data = { ...row.raw_data, ...best.raw_data };
  }

  const finalAttr = resolveMlsAttribution(best);
  best.listing_agent = finalAttr.listing_agent;
  best.listing_agent_phone = finalAttr.listing_agent_phone;
  best.listing_office = finalAttr.listing_office;
  best.listing_office_phone = finalAttr.listing_office_phone;

  return best;
}
