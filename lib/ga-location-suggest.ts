import type { SearchSuggestion } from "@/lib/listing-search-suggest";

/** Cities / ZIPs for instant prefix autocomplete when MLS OData can't fuzzy-match. */
const GA_LOCATIONS: ReadonlyArray<{ city: string; state: string; zips?: readonly string[] }> = [
  { city: "Milledgeville", state: "GA", zips: ["31061", "31062"] },
  { city: "Atlanta", state: "GA", zips: ["30301", "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313", "30314", "30315", "30316", "30318", "30319", "30324", "30326", "30327", "30328", "30329", "30331", "30332", "30334", "30336", "30339", "30341", "30342", "30345", "30346", "30350", "30354", "30360", "30362"] },
  { city: "Macon", state: "GA", zips: ["31201", "31204", "31206", "31210", "31211", "31216", "31217", "31220"] },
  { city: "Savannah", state: "GA", zips: ["31401", "31404", "31405", "31406", "31419"] },
  { city: "Augusta", state: "GA", zips: ["30901", "30904", "30906", "30907", "30909"] },
  { city: "Columbus", state: "GA", zips: ["31901", "31904", "31906", "31907", "31909"] },
  { city: "Athens", state: "GA", zips: ["30601", "30605", "30606", "30607"] },
  { city: "Warner Robins", state: "GA", zips: ["31088", "31093", "31098"] },
  { city: "Albany", state: "GA", zips: ["31701", "31705", "31707", "31721"] },
  { city: "Valdosta", state: "GA", zips: ["31601", "31602", "31605"] },
  { city: "Gainesville", state: "GA", zips: ["30501", "30504", "30506", "30507"] },
  { city: "Rome", state: "GA", zips: ["30161", "30165"] },
  { city: "Marietta", state: "GA", zips: ["30060", "30062", "30064", "30066", "30067", "30068"] },
  { city: "Roswell", state: "GA", zips: ["30075", "30076"] },
  { city: "Alpharetta", state: "GA", zips: ["30004", "30005", "30009", "30022"] },
  { city: "Sandy Springs", state: "GA", zips: ["30328", "30342", "30350"] },
  { city: "Lawrenceville", state: "GA", zips: ["30043", "30044", "30046"] },
  { city: "Decatur", state: "GA", zips: ["30030", "30032", "30033", "30034", "30035"] },
  { city: "Norcross", state: "GA", zips: ["30071", "30092", "30093"] },
  { city: "Dublin", state: "GA", zips: ["31021"] },
  { city: "Statesboro", state: "GA", zips: ["30458", "30461"] },
  { city: "Carrollton", state: "GA", zips: ["30117", "30118"] },
  { city: "Griffin", state: "GA", zips: ["30223", "30224"] },
  { city: "Newnan", state: "GA", zips: ["30263", "30265"] },
  { city: "Peachtree City", state: "GA", zips: ["30269", "30276"] },
  { city: "LaGrange", state: "GA", zips: ["30240", "30241"] },
  { city: "Dalton", state: "GA", zips: ["30720", "30721"] },
  { city: "Douglasville", state: "GA", zips: ["30134", "30135"] },
  { city: "Kennesaw", state: "GA", zips: ["30144", "30152"] },
  { city: "Woodstock", state: "GA", zips: ["30188", "30189"] },
  { city: "Canton", state: "GA", zips: ["30114", "30115"] },
  { city: "Covington", state: "GA", zips: ["30014", "30016"] },
  { city: "Conyers", state: "GA", zips: ["30012", "30013"] },
  { city: "McDonough", state: "GA", zips: ["30252", "30253"] },
  { city: "Stockbridge", state: "GA", zips: ["30281"] },
  { city: "Fayetteville", state: "GA", zips: ["30214", "30215"] },
  { city: "Hinesville", state: "GA", zips: ["31313"] },
  { city: "Brunswick", state: "GA", zips: ["31520", "31525"] },
  { city: "Pooler", state: "GA", zips: ["31322"] },
  { city: "Perry", state: "GA", zips: ["31069"] },
  { city: "Eatonton", state: "GA", zips: ["31024"] },
  { city: "Gray", state: "GA", zips: ["31032"] },
  { city: "Forsyth", state: "GA", zips: ["31029"] },
];

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

/** Prefix / substring matches for Georgia cities and ZIPs — no network required. */
export function localGaSearchSuggestions(raw: string): SearchSuggestion[] {
  const q = raw.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return [];

  const needle = normalizeToken(q);
  const digits = q.replace(/\D/g, "");
  const out: SearchSuggestion[] = [];
  const seenCity = new Set<string>();
  const seenZip = new Set<string>();

  for (const loc of GA_LOCATIONS) {
    const cityKey = `${normalizeToken(loc.city)}|${normalizeToken(loc.state)}`;
    const cityHay = normalizeToken(loc.city);
    if (
      !seenCity.has(cityKey) &&
      (cityHay.startsWith(needle) || cityHay.includes(needle))
    ) {
      seenCity.add(cityKey);
      out.push({
        id: `local-city-${cityKey}`,
        type: "city",
        label: `${loc.city}, ${loc.state}`,
        subtitle: "City",
        value: `${loc.city}, ${loc.state}`,
      });
    }

    if (digits.length >= 2) {
      for (const zip of loc.zips ?? []) {
        if (!zip.startsWith(digits) || seenZip.has(zip)) continue;
        seenZip.add(zip);
        out.push({
          id: `local-zip-${zip}`,
          type: "zip",
          label: zip,
          subtitle: `ZIP · ${loc.city}, ${loc.state}`,
          value: zip,
        });
      }
    }
  }

  return out.slice(0, 8);
}
