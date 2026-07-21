import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";

function getConfig() {
  const loginUrl = process.env.RETS_LOGIN_URL;
  const username = process.env.RETS_USERNAME;
  const password = process.env.RETS_PASSWORD;
  if (!loginUrl || !username || !password) {
    throw new Error("RETS_LOGIN_URL, RETS_USERNAME, and RETS_PASSWORD must be set");
  }
  return { loginUrl, username, password };
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// --- Digest Authentication ---

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string | undefined;
  opaque?: string | undefined;
}

function parseDigestChallenge(header: string): DigestChallenge | null {
  if (!header.toLowerCase().startsWith("digest ")) return null;
  const params: Record<string, string> = {};
  const matches = header.slice(7).matchAll(/(\w+)="([^"]+)"/g);
  for (const m of matches) {
    if (m[1] && m[2]) params[m[1]] = m[2];
  }
  const realm = params.realm;
  const nonce = params.nonce;
  if (!realm || !nonce) return null;
  return { realm, nonce, qop: params.qop, opaque: params.opaque };
}

function buildDigestHeader(
  method: string, uri: string, username: string, password: string, challenge: DigestChallenge, nc: number,
): string {
  const ha1 = crypto.createHash("md5").update(`${username}:${challenge.realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
  const cnonce = crypto.randomBytes(8).toString("hex");
  const ncStr = nc.toString(16).padStart(8, "0");

  let response: string;
  if (challenge.qop) {
    response = crypto.createHash("md5").update(`${ha1}:${challenge.nonce}:${ncStr}:${cnonce}:auth:${ha2}`).digest("hex");
  } else {
    response = crypto.createHash("md5").update(`${ha1}:${challenge.nonce}:${ha2}`).digest("hex");
  }

  let header = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;
  if (challenge.qop) header += `, qop=auth, nc=${ncStr}, cnonce="${cnonce}"`;
  if (challenge.opaque) header += `, opaque="${challenge.opaque}"`;
  return header;
}

// --- RETS Session ---

export interface RetsSession {
  searchUrl: string;
  metadataUrl: string;
  getObjectUrl: string;
  cookie: string;
  challenge: DigestChallenge;
  nc: number;
}

export async function createRetsSession(): Promise<RetsSession> {
  const config = getConfig();
  const loginUri = new URL(config.loginUrl).pathname;

  const initialRes = await fetch(config.loginUrl, {
    method: "GET",
    headers: { "User-Agent": "BuySellEric/1.0", "RETS-Version": "RETS/1.7.2" },
    redirect: "manual",
  });

  const wwwAuth = initialRes.headers.get("www-authenticate");
  if (!wwwAuth) throw new Error("RETS server did not return authentication challenge");

  const challenge = parseDigestChallenge(wwwAuth);
  if (!challenge) throw new Error("Could not parse digest auth challenge");

  const authHeader = buildDigestHeader("GET", loginUri, config.username, config.password, challenge, 1);

  const loginRes = await fetch(config.loginUrl, {
    method: "GET",
    headers: {
      "User-Agent": "BuySellEric/1.0",
      "RETS-Version": "RETS/1.7.2",
      Authorization: authHeader,
    },
    redirect: "manual",
  });

  const cookie = loginRes.headers.get("set-cookie") ?? "";
  const body = await loginRes.text();

  if (!body.includes("ReplyCode=\"0\"") && !body.includes('ReplyCode="0"')) {
    throw new Error(`RETS login failed: ${body.slice(0, 300)}`);
  }

  const baseUrl = new URL(config.loginUrl).origin;
  const searchMatch = body.match(/Search=([^\s<]+)/);
  const metadataMatch = body.match(/GetMetadata=([^\s<]+)/);
  const getObjectMatch = body.match(/GetObject=([^\s<]+)/);

  return {
    searchUrl: searchMatch ? baseUrl + searchMatch[1] : baseUrl + "/server/search",
    metadataUrl: metadataMatch ? baseUrl + metadataMatch[1] : baseUrl + "/server/getmetadata",
    getObjectUrl: getObjectMatch ? baseUrl + getObjectMatch[1] : baseUrl + "/server/getobject",
    cookie,
    challenge,
    nc: 2,
  };
}

async function retsFetch(session: RetsSession, url: string, params: Record<string, string>): Promise<string> {
  const config = getConfig();
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${qs}`;
  const uri = new URL(fullUrl).pathname + "?" + qs;

  const authHeader = buildDigestHeader("GET", uri, config.username, config.password, session.challenge, session.nc++);

  const res = await fetch(fullUrl, {
    headers: {
      "User-Agent": "BuySellEric/1.0",
      "RETS-Version": "RETS/1.7.2",
      Authorization: authHeader,
      Cookie: session.cookie,
    },
  });

  return await res.text();
}

function parseRetsReply(body: string): { replyCode: string; replyText: string } {
  const replyCode = body.match(/ReplyCode="([^"]+)"/)?.[1] ?? "";
  const replyText = body.match(/ReplyText="([^"]+)"/)?.[1] ?? "";
  return { replyCode, replyText };
}

/**
 * One URL per Media row — prefer highest-res fields so we do not store thumb + midsize + full as three "photos".
 */
function bestPhotoUrlFromRecord(r: Record<string, string>): string {
  const preference = [
    "OriginalURL",
    "MediaURLFull",
    "MediaURLHiRes",
    "MediaURL",
    "MediaMidsizeURL",
    "MediaThumbnailURL",
    "ImageURL",
    "PhotoURL",
    "URL",
    "Url",
  ];
  for (const k of preference) {
    const v = r[k];
    if (v && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(r)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return "";
}

/** Max photo URLs stored per listing (fetched via paginated RETS Media search). */
export const MLS_MEDIA_MAX_URLS = 500;
const RETS_MEDIA_PAGE_SIZE = 250;

function sortMediaRecords(records: Record<string, string>[]): { order: number; preferred: boolean; url: string }[] {
  return records
    .map((r) => ({
      order: Number(r.MediaOrder ?? r.Order ?? "999"),
      preferred:
        r.PreferredPhoto === "Y" ||
        r.PreferredPhoto === "y" ||
        r.PreferredPhoto === "true" ||
        r.PreferredPhoto === "1",
      url: bestPhotoUrlFromRecord(r),
    }))
    .filter((r) => r.url.startsWith("http"))
    .sort((a, b) => {
      if (a.preferred && !b.preferred) return -1;
      if (!a.preferred && b.preferred) return 1;
      return a.order - b.order;
    });
}

function dedupeUrlsPreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export interface PhotoProbeAttempt {
  query: string;
  standardNames: string;
  replyCode: string;
  replyText: string;
  recordCount: number;
  columnSample: string[];
  bodyPreview: string;
}

/**
 * GAMLS / RESO Media rows usually link via ResourceRecordKey or ListingKey, not MediaResourceId
 * (MediaResourceId often identifies the related resource type, not the listing id).
 */
export async function probeMediaSearch(listingId: string, maxPhotos: number = 10): Promise<PhotoProbeAttempt[]> {
  const session = await createRetsSession();
  const attempts: PhotoProbeAttempt[] = [];
  const queries = buildMediaQueryCandidates(listingId);

  for (const { query, standardNames } of queries) {
    const body = await retsFetch(session, session.searchUrl, {
      SearchType: "Media",
      Class: "Media",
      Query: query,
      QueryType: "DMQL2",
      Format: "COMPACT-DECODED",
      Limit: String(maxPhotos),
      Offset: "1",
      StandardNames: standardNames,
    });
    const { replyCode, replyText } = parseRetsReply(body);
    const records = parseCompactData(body);
    const colMatch = body.match(/<COLUMNS>([\s\S]*?)<\/COLUMNS>/);
    const delimMatch = body.match(/DELIMITER\s+value="(\d+)"/i);
    const delimiter = delimMatch ? String.fromCharCode(Number(delimMatch[1])) : "\t";
    const columnSample = colMatch?.[1]
      ? colMatch[1].trim().split(delimiter).map((c) => c.trim()).filter(Boolean).slice(0, 40)
      : [];

    attempts.push({
      query,
      standardNames,
      replyCode,
      replyText,
      recordCount: records.length,
      columnSample,
      bodyPreview: body.slice(0, 2500),
    });
  }

  return attempts;
}

function buildMediaQueryCandidates(listingId: string): { query: string; standardNames: string }[] {
  const id = listingId.trim();
  // GAMLS: MediaResourceId + Photo works first; other boards may need fallbacks below.
  const q: { query: string; standardNames: string }[] = [
    { query: `(MediaResourceId=${id}),(MediaCategory=Photo)`, standardNames: "0" },
    { query: `(ResourceRecordKey=${id}),(MediaCategory=Photo)`, standardNames: "0" },
    { query: `(ResourceRecordKey=${id})`, standardNames: "0" },
    { query: `(ListingKey=${id}),(MediaCategory=Photo)`, standardNames: "0" },
    { query: `(ListingId=${id}),(MediaCategory=Photo)`, standardNames: "0" },
    { query: `(MediaListingKey=${id}),(MediaCategory=Photo)`, standardNames: "0" },
    { query: `(ListingKey=${id}),(MediaCategory=Photo)`, standardNames: "1" },
    { query: `(ResourceRecordKey=${id}),(MediaCategory=Photo)`, standardNames: "1" },
  ];
  return q;
}

/** Fetch photo URLs using an existing RETS session (digest nonce counter must stay sequential). */
export async function fetchPhotoUrlsWithSession(
  session: RetsSession,
  listingId: string,
  maxPhotos: number = MLS_MEDIA_MAX_URLS,
): Promise<string[]> {
  const cap = Math.min(Math.max(1, maxPhotos), 999);
  const pageSize = Math.min(RETS_MEDIA_PAGE_SIZE, cap);
  const queries = buildMediaQueryCandidates(listingId);

  for (const { query, standardNames } of queries) {
    const allRecords: Record<string, string>[] = [];
    let offset = 1;

    for (;;) {
      const body = await retsFetch(session, session.searchUrl, {
        SearchType: "Media",
        Class: "Media",
        Query: query,
        QueryType: "DMQL2",
        Format: "COMPACT-DECODED",
        Limit: String(pageSize),
        Offset: String(offset),
        StandardNames: standardNames,
      });

      const { replyCode } = parseRetsReply(body);
      if (replyCode && replyCode !== "0") {
        if (offset === 1) break;
        break;
      }

      const page = parseCompactData(body);
      if (page.length === 0) break;
      allRecords.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
      if (allRecords.length >= cap * 2) break;
    }

    if (allRecords.length === 0) continue;

    const sorted = sortMediaRecords(allRecords);
    const urls = dedupeUrlsPreserveOrder(sorted.map((r) => r.url));
    if (urls.length > 0) return urls.slice(0, cap);
  }

  return [];
}

export async function fetchPhotoUrls(listingId: string, maxPhotos: number = MLS_MEDIA_MAX_URLS): Promise<string[]> {
  const session = await createRetsSession();
  return fetchPhotoUrlsWithSession(session, listingId, maxPhotos);
}

export async function rawSearch(query: string, limit: number = 5): Promise<string> {
  return rawSearchAny("Property", "RESI", query, limit);
}

export async function rawSearchAny(
  resource: string,
  classId: string,
  query: string,
  limit: number = 5,
  select: string = "",
): Promise<string> {
  const session = await createRetsSession();
  const params: Record<string, string> = {
    SearchType: resource,
    Class: classId,
    Query: query,
    QueryType: "DMQL2",
    Format: "COMPACT-DECODED",
    Limit: String(limit),
    Offset: "1",
    StandardNames: "0",
    Count: "1",
  };
  if (select) params.Select = select;
  return retsFetch(session, session.searchUrl, params);
}

// --- Metadata ---

export async function getMetadataResources(): Promise<unknown> {
  const session = await createRetsSession();
  const body = await retsFetch(session, session.metadataUrl, {
    Type: "METADATA-RESOURCE", ID: "0", Format: "STANDARD-XML",
  });
  return xmlParser.parse(body);
}

export async function getMetadataClasses(resourceId: string): Promise<unknown> {
  const session = await createRetsSession();
  const body = await retsFetch(session, session.metadataUrl, {
    Type: "METADATA-CLASS", ID: resourceId, Format: "STANDARD-XML",
  });
  return xmlParser.parse(body);
}

export async function getMetadataTable(resourceId: string, classId: string): Promise<unknown> {
  const session = await createRetsSession();
  const body = await retsFetch(session, session.metadataUrl, {
    Type: "METADATA-TABLE", ID: `${resourceId}:${classId}`, Format: "STANDARD-XML",
  });
  return xmlParser.parse(body);
}

// --- Search ---

function parseCompactData(body: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];

  const delimMatch = body.match(/DELIMITER\s+value="(\d+)"/i);
  const delimiter = delimMatch ? String.fromCharCode(Number(delimMatch[1])) : "\t";

  const columnsMatch = body.match(/<COLUMNS>([\s\S]*?)<\/COLUMNS>/);
  if (!columnsMatch || !columnsMatch[1]) return records;
  const columns = columnsMatch[1].trim().split(delimiter).map((c) => c.trim()).filter(Boolean);

  const dataRegex = /<DATA>([\s\S]*?)<\/DATA>/g;
  let match: RegExpExecArray | null;
  while ((match = dataRegex.exec(body)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    const values = raw.trim().split(delimiter);
    const record: Record<string, string> = {};
    for (let i = 0; i < columns.length && i < values.length; i++) {
      const col = columns[i];
      const val = values[i];
      if (col && val) record[col] = val.trim();
    }
    if (Object.keys(record).length > 0) records.push(record);
  }

  return records;
}

export interface MlsListingData {
  mls_id: string;
  title: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  price_cents: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string;
  property_type: string;
  status: string;
  image_urls: string[];
  listing_agent: string;
  listing_agent_phone: string;
  listing_office: string;
  listing_office_phone: string;
  raw_data: Record<string, unknown>;
}

export function mapRetsRecord(record: Record<string, string>): MlsListingData {
  const get = (keys: string[]): string => {
    for (const k of keys) {
      if (record[k] != null && record[k] !== "") return record[k];
    }
    return "";
  };

  const getNum = (keys: string[]): number => {
    const v = get(keys);
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getNumOrNull = (keys: string[]): number | null => {
    const v = get(keys);
    if (!v) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const mlsId = get(["ListingId"]);
  const unparsedAddr = get(["UnparsedAddress"]);
  const streetNum = get(["StreetNumber"]);
  const streetDir = get(["StreetDirPrefix"]);
  const streetName = get(["StreetName"]);
  const streetSuffix = get(["StreetSuffix"]);
  const streetDirSuffix = get(["StreetDirSuffix"]);
  const unitNum = get(["UnitNumber", "Unit"]);

  let addressLine = unparsedAddr;
  if (!addressLine) {
    const parts = [streetNum, streetDir, streetName, streetSuffix, streetDirSuffix].filter(Boolean);
    addressLine = parts.join(" ");
    if (unitNum) addressLine += ` #${unitNum}`;
  }

  const city = get(["City"]);
  const state = get(["StateOrProvince"]);
  const postalCode = get(["PostalCode"]);
  const priceDollars = getNum(["ListPrice"]);
  const remarks = get([
    "PublicRemarks",
    "InternetRemarks",
    "Remarks",
    "ListingRemarks",
    "MarketingRemarks",
    "IDXRemarks",
    "SupplementalPublicRemarks",
  ]);
  const subdivision = get(["SubdivisionName"]);

  const validSubdivision = subdivision && subdivision.toLowerCase() !== "none" ? subdivision : "";

  return {
    mls_id: mlsId,
    title: validSubdivision ? `${validSubdivision} · ${addressLine}` : addressLine || `${city} Home`,
    address_line: addressLine,
    city,
    state: state || "GA",
    postal_code: postalCode,
    price_cents: Math.round(priceDollars * 100),
    bedrooms: Math.round(getNum(["BedroomsTotal"])),
    bathrooms: getNum(["BathroomsFull"]),
    square_feet: getNumOrNull(["LivingArea"]),
    latitude: getNumOrNull(["Latitude"]),
    longitude: getNumOrNull(["Longitude"]),
    description: remarks,
    property_type: get(["PropertySubType", "PropertyType"]),
    status: get(["MlsStatus"]),
    image_urls: [],
    listing_agent: get(["ListAgent", "ListAgentFullName"]),
    listing_agent_phone: get([
      "ListAgentPreferredPhone",
      "ListAgentDirectPhone",
      "ListAgentCellPhone",
      "ListAgentPhone",
    ]),
    listing_office: get(["ListOffice", "ListOfficeName"]),
    listing_office_phone: get(["ListOfficePhone"]),
    raw_data: record as Record<string, unknown>,
  };
}

/** Total matches from RETS search when Count=1 (attribute name varies by server). */
function parseRetsSearchTotalCount(body: string): number | null {
  const retsOpen = body.match(/<RETS\b[^>]*>/i)?.[0] ?? "";
  const fromRets =
    retsOpen.match(/\bRecords="(\d+)"/i)?.[1] ??
    retsOpen.match(/\bCount="(\d+)"/i)?.[1] ??
    retsOpen.match(/\bTotalRecords="(\d+)"/i)?.[1];
  if (fromRets) {
    const n = Number(fromRets);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const countTag = body.match(/<COUNT[^>]*>(\d+)<\/COUNT>/i)?.[1];
  if (countTag) {
    const n = Number(countTag);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (/<RETS[^>]*ReplyCode="20201"/i.test(body)) return 0;
  return null;
}

/**
 * @param offset - 0-based index of first row to return (RETS Offset is offset+1).
 */
export async function searchActiveListingsWithSession(
  session: RetsSession,
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean; count: number }> {
  const body = await retsFetch(session, session.searchUrl, {
    SearchType: "Property",
    Class: "RESI",
    Query: "(ListPrice=1+)",
    QueryType: "DMQL2",
    Format: "COMPACT-DECODED",
    Limit: String(limit),
    Offset: String(offset + 1),
    StandardNames: "0",
    Count: "1",
  });

  const rawRecords = parseCompactData(body);
  const records = rawRecords.map(mapRetsRecord).filter((r) => r.mls_id);

  const totalFromRets = parseRetsSearchTotalCount(body);
  const totalCount = totalFromRets ?? offset + records.length;
  const nextOffset = offset + records.length;
  const hasMore =
    records.length > 0 &&
    (totalFromRets != null ? nextOffset < totalFromRets : records.length >= limit);

  return {
    records,
    hasMore,
    count: totalCount,
  };
}

export async function searchActiveListings(
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean; count: number }> {
  const session = await createRetsSession();
  return searchActiveListingsWithSession(session, offset, limit);
}

export async function searchListingsSince(
  since: Date,
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean }> {
  const session = await createRetsSession();
  const ts = since.toISOString().replace("T", " ").slice(0, 19);

  const body = await retsFetch(session, session.searchUrl, {
    SearchType: "Property",
    Class: "RESI",
    Query: `(ListPrice=1+),(ModificationTimestamp=${ts}+)`,
    QueryType: "DMQL2",
    Format: "COMPACT-DECODED",
    Limit: String(limit),
    Offset: String(offset + 1),
    StandardNames: "0",
    Count: "1",
  });

  const rawRecords = parseCompactData(body);
  const records = rawRecords.map(mapRetsRecord).filter((r) => r.mls_id);

  const totalFromRets = parseRetsSearchTotalCount(body);
  const nextOffset = offset + records.length;
  const fullPage = records.length >= limit;
  const hasMore =
    records.length > 0 && (fullPage || (totalFromRets != null && nextOffset < totalFromRets));

  return { records, hasMore };
}

export function isRetsConfigured(): boolean {
  return Boolean(
    process.env.RETS_LOGIN_URL?.trim() &&
      process.env.RETS_USERNAME?.trim() &&
      process.env.RETS_PASSWORD?.trim(),
  );
}

const RETS_ATTR_SELECT = [
  "ListingId",
  "ListAgent",
  "ListAgentFullName",
  "ListAgentFirstName",
  "ListAgentLastName",
  "ListAgentPreferredPhone",
  "ListAgentDirectPhone",
  "ListAgentCellPhone",
  "ListAgentPhone",
  "ListAgentEmail",
  "ListOffice",
  "ListOfficeName",
  "ListOfficePhone",
  "ListOfficeEmail",
].join(",");

function pickRetsField(record: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = record[k]?.trim();
    if (v) return v;
  }
  const lower = Object.fromEntries(Object.entries(record).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase()]?.trim();
    if (v) return v;
  }
  return "";
}

async function retsSearchFirst(
  resource: string,
  classId: string,
  query: string,
  select: string,
): Promise<Record<string, string> | null> {
  try {
    const body = await rawSearchAny(resource, classId, query, 1, select);
    const rows = parseCompactData(body);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve GAMLS ConnectMLS Agent / Office codes to display names + phones.
 * Property rows often only store ListAgent=USERCODE / ListOffice=OFFICEID.
 */
export async function resolveRetsAgentOfficeCodes(
  agentCode: string,
  officeCode: string,
): Promise<{
  listing_agent: string;
  listing_agent_phone: string;
  listing_agent_email: string;
  listing_office: string;
  listing_office_phone: string;
  listing_office_email: string;
  raw: Record<string, unknown>;
}> {
  const raw: Record<string, unknown> = {};
  let listing_agent = "";
  let listing_agent_phone = "";
  let listing_agent_email = "";
  let listing_office = "";
  let listing_office_phone = "";
  let listing_office_email = "";

  const agentId = agentCode.trim();
  const officeId = officeCode.trim();

  const agentSelect =
    "AgentID,UserCode,MemberMlsId,FirstName,LastName,FullName,AgentFullName,PreferredPhone,DirectPhone,CellPhone,OfficePhone,Email,URL";
  const officeSelect = "OfficeID,OfficeMlsId,OfficeName,Name,Phone,OfficePhone,Email,URL,Website";

  const agentTries: Array<Promise<Record<string, string> | null>> = [];
  if (agentId) {
    for (const q of [
      `(AgentID=${agentId})`,
      `(UserCode=${agentId})`,
      `(MemberMlsId=${agentId})`,
    ]) {
      for (const classId of ["Agent", "ActiveAgent"]) {
        agentTries.push(retsSearchFirst("Agent", classId, q, agentSelect));
      }
    }
  }

  const officeTries: Array<Promise<Record<string, string> | null>> = [];
  if (officeId) {
    for (const q of [`(OfficeID=${officeId})`, `(OfficeMlsId=${officeId})`]) {
      for (const classId of ["Office", "ActiveOffice"]) {
        officeTries.push(retsSearchFirst("Office", classId, q, officeSelect));
      }
    }
  }

  const [agentRows, officeRows] = await Promise.all([
    Promise.all(agentTries),
    Promise.all(officeTries),
  ]);

  for (const row of agentRows) {
    if (!row) continue;
    raw.RetsAgent = row;
    listing_agent =
      pickRetsField(row, ["FullName", "AgentFullName", "MemberFullName"]) ||
      [pickRetsField(row, ["FirstName"]), pickRetsField(row, ["LastName"])].filter(Boolean).join(" ");
    listing_agent_phone = pickRetsField(row, [
      "PreferredPhone",
      "DirectPhone",
      "CellPhone",
      "OfficePhone",
      "Phone",
    ]);
    listing_agent_email = pickRetsField(row, ["Email", "AgentEmail", "MemberEmail"]);
    if (listing_agent) break;
  }
  if (agentId && !listing_agent) listing_agent = agentId;

  for (const row of officeRows) {
    if (!row) continue;
    raw.RetsOffice = row;
    listing_office = pickRetsField(row, ["OfficeName", "Name", "BrokerageName"]);
    listing_office_phone = pickRetsField(row, ["Phone", "OfficePhone", "MainOfficePhone"]);
    listing_office_email = pickRetsField(row, ["Email", "OfficeEmail"]);
    if (listing_office) break;
  }
  if (officeId && !listing_office) listing_office = officeId;

  return {
    listing_agent,
    listing_agent_phone,
    listing_agent_email,
    listing_office,
    listing_office_phone,
    listing_office_email,
    raw,
  };
}

/**
 * Fetch listing-agent / broker attribution from ConnectMLS RETS for one MLS id.
 * Used when Bridge IDX omits agent/office names (common on gamls2).
 */
export async function fetchRetsAttributionForMlsId(mlsId: string): Promise<{
  listing_agent: string;
  listing_agent_phone: string;
  listing_office: string;
  listing_office_phone: string;
  raw_data: Record<string, unknown>;
} | null> {
  if (!isRetsConfigured()) return null;
  const id = mlsId.trim();
  if (!id || !/^\d+$/.test(id)) return null;

  const propSelect = RETS_ATTR_SELECT;
  const prop =
    (await retsSearchFirst("Property", "RESI", `(ListingId=${id})`, propSelect)) ||
    (await retsSearchFirst("Property", "RESI", `(ListingID=${id})`, propSelect));
  if (!prop) return null;

  const agentCode = pickRetsField(prop, ["ListAgent", "ListAgentMlsId", "ListAgentKey"]);
  const officeCode = pickRetsField(prop, ["ListOffice", "ListOfficeMlsId", "ListOfficeKey"]);

  const fromPropName =
    pickRetsField(prop, ["ListAgentFullName"]) ||
    [pickRetsField(prop, ["ListAgentFirstName"]), pickRetsField(prop, ["ListAgentLastName"])]
      .filter(Boolean)
      .join(" ");
  const fromPropOffice = pickRetsField(prop, ["ListOfficeName"]);
  const fromPropAgentPhone = pickRetsField(prop, [
    "ListAgentPreferredPhone",
    "ListAgentDirectPhone",
    "ListAgentCellPhone",
    "ListAgentPhone",
  ]);
  const fromPropOfficePhone = pickRetsField(prop, ["ListOfficePhone"]);

  const resolved = await resolveRetsAgentOfficeCodes(
    fromPropName ? "" : agentCode,
    fromPropOffice ? "" : officeCode,
  );

  const listing_agent = fromPropName || resolved.listing_agent || agentCode;
  const listing_office = fromPropOffice || resolved.listing_office || officeCode;
  const listing_agent_phone = fromPropAgentPhone || resolved.listing_agent_phone;
  const listing_office_phone = fromPropOfficePhone || resolved.listing_office_phone;

  if (!listing_agent && !listing_office && !listing_agent_phone && !listing_office_phone) {
    return null;
  }

  const raw_data: Record<string, unknown> = {
    ...prop,
    ...resolved.raw,
    ...(listing_agent ? { ListAgentFullName: listing_agent } : {}),
    ...(listing_office ? { ListOfficeName: listing_office } : {}),
    ...(listing_agent_phone ? { ListAgentPreferredPhone: listing_agent_phone } : {}),
    ...(listing_office_phone ? { ListOfficePhone: listing_office_phone } : {}),
    ...(resolved.listing_agent_email || pickRetsField(prop, ["ListAgentEmail"])
      ? {
          ListAgentEmail:
            resolved.listing_agent_email || pickRetsField(prop, ["ListAgentEmail"]),
        }
      : {}),
    ...(resolved.listing_office_email || pickRetsField(prop, ["ListOfficeEmail"])
      ? {
          ListOfficeEmail:
            resolved.listing_office_email || pickRetsField(prop, ["ListOfficeEmail"]),
        }
      : {}),
  };

  return {
    listing_agent,
    listing_agent_phone,
    listing_office,
    listing_office_phone,
    raw_data,
  };
}
