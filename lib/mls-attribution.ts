import type { MlsListingRow } from "@/lib/types/db";

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
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

function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function httpHref(url: string): string {
  const t = url.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[\w.-]+/i.test(t)) return `https://${t}`;
  return "";
}

export type MlsAttribution = {
  listing_agent: string;
  listing_agent_phone: string;
  listing_agent_email: string;
  listing_agent_url: string;
  listing_office: string;
  listing_office_phone: string;
  listing_office_email: string;
  listing_office_url: string;
};

/**
 * Resolve display attribution from mapped columns + raw RESO payload
 * (including Bridge `$expand=ListAgent,ListOffice` / Members / Offices objects).
 */
export function resolveMlsAttribution(listing: MlsListingRow): MlsAttribution {
  const raw = listing.raw_data ?? {};
  const agentObj =
    asRecord(raw.ListAgent) ?? asRecord(raw.Member) ?? asRecord(raw.ListMember);
  const officeObj = asRecord(raw.ListOffice) ?? asRecord(raw.Office);

  const listAgentFirstLast = [str(raw.ListAgentFirstName), str(raw.ListAgentLastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const coFirstLast = [str(raw.CoListAgentFirstName), str(raw.CoListAgentLastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const expandedAgentName =
    (agentObj &&
      (str(agentObj.MemberFullName) ||
        str(agentObj.FullName) ||
        [
          str(agentObj.MemberFirstName) || str(agentObj.FirstName) || str(agentObj.firstName),
          str(agentObj.MemberLastName) || str(agentObj.LastName) || str(agentObj.lastName),
        ]
          .filter(Boolean)
          .join(" ")
          .trim())) ||
    "";
  const expandedOfficeName =
    (officeObj &&
      (str(officeObj.OfficeName) ||
        str(officeObj.Name) ||
        str(officeObj.name) ||
        str(officeObj.BrokerageName))) ||
    "";

  let listing_agent =
    listing.listing_agent ||
    str(raw.ListAgentFullName) ||
    str(raw.ListAgent) ||
    listAgentFirstLast ||
    expandedAgentName ||
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
    str(raw.ListAgentPhone) ||
    (agentObj
      ? str(agentObj.MemberPreferredPhone) ||
        str(agentObj.PreferredPhone) ||
        str(agentObj.MemberDirectPhone) ||
        str(agentObj.DirectPhone) ||
        str(agentObj.phone)
      : "");

  const listing_agent_email =
    str(raw.ListAgentEmail) ||
    (agentObj ? str(agentObj.MemberEmail) || str(agentObj.Email) || str(agentObj.email) : "");

  const listing_agent_url =
    str(raw.ListAgentURL) ||
    (agentObj
      ? str(agentObj.MemberURL) || str(agentObj.Website) || str(agentObj.url)
      : "");

  let listing_office =
    listing.listing_office ||
    str(raw.ListOfficeName) ||
    str(raw.ListOffice) ||
    str(raw.ListCompany) ||
    str(raw.ListBrokerageName) ||
    expandedOfficeName;

  let listing_office_phone =
    listing.listing_office_phone ||
    str(raw.ListOfficePhone) ||
    str(raw.ListOfficeFax) ||
    (officeObj
      ? str(officeObj.OfficePhone) || str(officeObj.Phone) || str(officeObj.phone)
      : "");

  const listing_office_email =
    str(raw.ListOfficeEmail) ||
    (officeObj ? str(officeObj.OfficeEmail) || str(officeObj.Email) || str(officeObj.email) : "");

  const listing_office_url =
    str(raw.ListOfficeURL) ||
    (officeObj
      ? str(officeObj.OfficeUrl) || str(officeObj.Website) || str(officeObj.url)
      : "");

  if (listing_office && !listing_office_phone && listing_office.includes(" · ")) {
    const split = splitNamePhone(listing_office);
    listing_office = split.name;
    listing_office_phone = split.phone;
  }

  return {
    listing_agent,
    listing_agent_phone,
    listing_agent_email,
    listing_agent_url,
    listing_office,
    listing_office_phone,
    listing_office_email,
    listing_office_url,
  };
}

export function hasMlsAttribution(listing: MlsListingRow): boolean {
  const a = resolveMlsAttribution(listing);
  return Boolean(
    a.listing_agent ||
      a.listing_agent_phone ||
      a.listing_agent_email ||
      a.listing_office ||
      a.listing_office_phone ||
      a.listing_office_email,
  );
}

/** Compact muted attribution bits for the detail footer (names, phones, mailto/web links). */
export function formatMlsAttributionParts(listing: MlsListingRow): string[] {
  const a = resolveMlsAttribution(listing);
  const parts: string[] = [];

  const agentBits: string[] = [];
  if (a.listing_agent) agentBits.push(a.listing_agent);
  if (a.listing_agent_phone) agentBits.push(a.listing_agent_phone);
  if (a.listing_agent_email) agentBits.push(a.listing_agent_email);
  if (agentBits.length) parts.push(`Listing agent: ${agentBits.join(" · ")}`);

  const officeBits: string[] = [];
  if (a.listing_office) officeBits.push(a.listing_office);
  if (a.listing_office_phone) officeBits.push(a.listing_office_phone);
  if (a.listing_office_email) officeBits.push(a.listing_office_email);
  if (officeBits.length) parts.push(`Broker: ${officeBits.join(" · ")}`);

  return parts;
}

/** Linkable attribution for React (phones / email / websites). */
export function mlsAttributionLinks(listing: MlsListingRow): {
  agentTel: string;
  agentMailto: string;
  agentWeb: string;
  officeTel: string;
  officeMailto: string;
  officeWeb: string;
} {
  const a = resolveMlsAttribution(listing);
  return {
    agentTel: phoneHref(a.listing_agent_phone),
    agentMailto: a.listing_agent_email ? `mailto:${a.listing_agent_email}` : "",
    agentWeb: httpHref(a.listing_agent_url),
    officeTel: phoneHref(a.listing_office_phone),
    officeMailto: a.listing_office_email ? `mailto:${a.listing_office_email}` : "",
    officeWeb: httpHref(a.listing_office_url),
  };
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
  if (a.listing_agent_email) s += 4;
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
