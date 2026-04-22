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

interface RetsSession {
  searchUrl: string;
  metadataUrl: string;
  getObjectUrl: string;
  cookie: string;
  challenge: DigestChallenge;
  nc: number;
}

async function retsLogin(): Promise<RetsSession> {
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

export async function fetchPhotoUrls(listingId: string, maxPhotos: number = 10): Promise<string[]> {
  const session = await retsLogin();

  const body = await retsFetch(session, session.searchUrl, {
    SearchType: "Media",
    Class: "Media",
    Query: `(MediaResourceKey=${listingId}),(MediaType=Photo)`,
    QueryType: "DMQL2",
    Format: "COMPACT-DECODED",
    Limit: String(maxPhotos),
    Offset: "1",
    StandardNames: "0",
  });

  const records = parseCompactData(body);

  const sorted = records
    .map((r) => ({
      order: Number(r.MediaOrder ?? "999"),
      preferred: r.PreferredPhoto === "Y" || r.PreferredPhoto === "true" || r.PreferredPhoto === "1",
      url: r.MediaURL || r.OriginalURL || r.MediaMidsizeURL || r.MediaThumbnailURL || "",
    }))
    .filter((r) => r.url && r.url.startsWith("http"))
    .sort((a, b) => {
      if (a.preferred && !b.preferred) return -1;
      if (!a.preferred && b.preferred) return 1;
      return a.order - b.order;
    });

  return sorted.map((r) => r.url);
}

export async function rawSearch(query: string, limit: number = 5): Promise<string> {
  return rawSearchAny("Property", "RESI", query, limit);
}

export async function rawSearchAny(
  resource: string,
  classId: string,
  query: string,
  limit: number = 5,
): Promise<string> {
  const session = await retsLogin();
  return retsFetch(session, session.searchUrl, {
    SearchType: resource,
    Class: classId,
    Query: query,
    QueryType: "DMQL2",
    Format: "COMPACT-DECODED",
    Limit: String(limit),
    Offset: "1",
    StandardNames: "0",
    Count: "1",
  });
}

// --- Metadata ---

export async function getMetadataResources(): Promise<unknown> {
  const session = await retsLogin();
  const body = await retsFetch(session, session.metadataUrl, {
    Type: "METADATA-RESOURCE", ID: "0", Format: "STANDARD-XML",
  });
  return xmlParser.parse(body);
}

export async function getMetadataClasses(resourceId: string): Promise<unknown> {
  const session = await retsLogin();
  const body = await retsFetch(session, session.metadataUrl, {
    Type: "METADATA-CLASS", ID: resourceId, Format: "STANDARD-XML",
  });
  return xmlParser.parse(body);
}

export async function getMetadataTable(resourceId: string, classId: string): Promise<unknown> {
  const session = await retsLogin();
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
  listing_office: string;
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
  const remarks = get(["PublicRemarks"]);
  const subdivision = get(["SubdivisionName"]);

  return {
    mls_id: mlsId,
    title: subdivision ? `${subdivision} · ${addressLine}` : addressLine || `${city} Home`,
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
    listing_agent: get(["ListAgent"]),
    listing_office: get(["ListOffice"]),
    raw_data: record as Record<string, unknown>,
  };
}

export async function searchActiveListings(
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean; count: number }> {
  const session = await retsLogin();

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

  const countMatch = body.match(/Records="(\d+)"/);
  const totalCount = countMatch ? Number(countMatch[1]) : records.length;

  return {
    records,
    hasMore: records.length >= limit,
    count: totalCount,
  };
}

export async function searchListingsSince(
  since: Date,
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean }> {
  const session = await retsLogin();
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
  });

  const rawRecords = parseCompactData(body);
  const records = rawRecords.map(mapRetsRecord).filter((r) => r.mls_id);

  return { records, hasMore: records.length >= limit };
}
