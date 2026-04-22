/* eslint-disable @typescript-eslint/no-explicit-any */
import rets from "rets-client";

function getConfig() {
  const loginUrl = process.env.RETS_LOGIN_URL;
  const username = process.env.RETS_USERNAME;
  const password = process.env.RETS_PASSWORD;

  if (!loginUrl || !username || !password) {
    throw new Error("RETS_LOGIN_URL, RETS_USERNAME, and RETS_PASSWORD must be set");
  }

  return { loginUrl, username, password };
}

export async function withRetsClient<T>(
  fn: (client: any) => Promise<T>,
): Promise<T> {
  const config = getConfig();

  return rets.getAutoLogoutClient(
    {
      loginUrl: config.loginUrl,
      username: config.username,
      password: config.password,
      version: "RETS/1.7.2",
      userAgent: "BuySellEric/1.0",
    } as any,
    (client: any) => fn(client),
  ) as Promise<T>;
}

export async function getMetadataResources(): Promise<unknown> {
  return withRetsClient(async (client) => {
    return await client.metadata.getResources();
  });
}

export async function getMetadataClasses(resourceId: string): Promise<unknown> {
  return withRetsClient(async (client) => {
    return await client.metadata.getClass(resourceId);
  });
}

export async function getMetadataTable(resourceId: string, classId: string): Promise<unknown> {
  return withRetsClient(async (client) => {
    return await client.metadata.getTable(resourceId, classId);
  });
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

/**
 * Maps a RETS record to our mls_listings schema.
 * Field names will be finalized after metadata discovery --
 * these are common RETS/RESO field names that GAMLS likely uses.
 * After running the metadata route, update these mappings.
 */
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

  const mlsId = get(["ListingId", "ListingKey", "L_ListingID", "MLSNumber", "Matrix_Unique_ID"]);
  const streetNum = get(["StreetNumber", "L_AddressNumber", "StreetNumberNumeric"]);
  const streetDir = get(["StreetDirPrefix", "L_AddressDirection"]);
  const streetName = get(["StreetName", "L_AddressStreet"]);
  const streetSuffix = get(["StreetSuffix", "L_AddressSuffix"]);
  const unitNum = get(["UnitNumber", "L_AddressUnit"]);

  const addressParts = [streetNum, streetDir, streetName, streetSuffix].filter(Boolean);
  let addressLine = addressParts.join(" ");
  if (unitNum) addressLine += `, ${unitNum}`;

  const city = get(["City", "L_City"]);
  const state = get(["StateOrProvince", "L_State", "State"]);
  const postalCode = get(["PostalCode", "L_Zip", "ZipCode"]);
  const priceDollars = getNum(["ListPrice", "L_AskingPrice", "CurrentPrice", "OriginalListPrice"]);

  return {
    mls_id: mlsId,
    title: get(["PublicRemarks", "L_Remarks"]).slice(0, 100) || `${addressLine}, ${city}`,
    address_line: addressLine,
    city,
    state: state || "GA",
    postal_code: postalCode,
    price_cents: Math.round(priceDollars * 100),
    bedrooms: Math.round(getNum(["BedroomsTotal", "L_Bedrooms", "Bedrooms"])),
    bathrooms: getNum(["BathroomsTotalDecimal", "BathroomsFull", "L_Baths", "Bathrooms"]),
    square_feet: getNumOrNull(["LivingArea", "L_SquareFeet", "SqFtTotal", "BuildingAreaTotal"]),
    latitude: getNumOrNull(["Latitude", "L_Latitude"]),
    longitude: getNumOrNull(["Longitude", "L_Longitude"]),
    description: get(["PublicRemarks", "L_Remarks", "Remarks"]),
    property_type: get(["PropertyType", "PropertySubType", "L_Type_"]),
    status: get(["StandardStatus", "MlsStatus", "L_Status", "Status"]),
    image_urls: [],
    listing_agent: get(["ListAgentFullName", "L_ListAgent1", "ListAgentName"]),
    listing_office: get(["ListOfficeName", "L_ListOffice1", "ListOffice"]),
    raw_data: record as Record<string, unknown>,
  };
}

export async function searchActiveListings(
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean; count: number }> {
  return withRetsClient(async (client) => {
    const query = "(Status=A)";

    const searchResult = await client.search.query(
      "Property",
      "Residential",
      query,
      {
        limit,
        offset,
        restrictedIndicator: "***",
      },
    );

    const records = (searchResult.results || []).map((r: Record<string, string>) =>
      mapRetsRecord(r),
    );

    return {
      records,
      hasMore: records.length >= limit,
      count: searchResult.count || records.length,
    };
  });
}

export async function searchListingsSince(
  since: Date,
  offset: number = 0,
  limit: number = 2500,
): Promise<{ records: MlsListingData[]; hasMore: boolean }> {
  return withRetsClient(async (client) => {
    const ts = since.toISOString().replace("T", " ").slice(0, 19);
    const query = `(Status=A),(ModificationTimestamp=${ts}+)`;

    const searchResult = await client.search.query(
      "Property",
      "Residential",
      query,
      {
        limit,
        offset,
        restrictedIndicator: "***",
      },
    );

    const records = (searchResult.results || []).map((r: Record<string, string>) =>
      mapRetsRecord(r),
    );

    return {
      records,
      hasMore: records.length >= limit,
    };
  });
}
