/**
 * Rough ZIP centroids for Georgia / metro Atlanta — used when MLS search returns no rows for
 * OData Latitude/Longitude bbox (common when coords are null in the index) so we can still
 * approximate “inside the drawn shape” using postal codes from Property rows.
 *
 * Exact ZIP table is sparse; unknown 5-digit zips fall back to a 3-digit prefix centroid.
 */

const ZIP5: Readonly<Record<string, { lat: number; lng: number }>> = {
  "30301": { lat: 33.7627, lng: -84.4225 },
  "30303": { lat: 33.7557, lng: -84.3893 },
  "30305": { lat: 33.83, lng: -84.385 },
  "30306": { lat: 33.786, lng: -84.351 },
  "30307": { lat: 33.771, lng: -84.341 },
  "30308": { lat: 33.773, lng: -84.372 },
  "30309": { lat: 33.798, lng: -84.388 },
  "30310": { lat: 33.724, lng: -84.408 },
  "30311": { lat: 33.723, lng: -84.447 },
  "30312": { lat: 33.745, lng: -84.391 },
  "30313": { lat: 33.749, lng: -84.404 },
  "30314": { lat: 33.756, lng: -84.418 },
  "30315": { lat: 33.706, lng: -84.393 },
  "30316": { lat: 33.714, lng: -84.352 },
  "30317": { lat: 33.705, lng: -84.33 },
  "30318": { lat: 33.789, lng: -84.452 },
  "30319": { lat: 33.875, lng: -84.335 },
  "30324": { lat: 33.822, lng: -84.368 },
  "30326": { lat: 33.848, lng: -84.361 },
  "30327": { lat: 33.886, lng: -84.42 },
  "30328": { lat: 33.93, lng: -84.38 },
  "30329": { lat: 33.825, lng: -84.325 },
  "30331": { lat: 33.715, lng: -84.55 },
  "30332": { lat: 33.771, lng: -84.397 },
  "30334": { lat: 33.749, lng: -84.39 },
  "30336": { lat: 33.749, lng: -84.39 },
  "30339": { lat: 33.875, lng: -84.465 },
  "30341": { lat: 33.87, lng: -84.29 },
  "30342": { lat: 33.915, lng: -84.35 },
  "30345": { lat: 33.85, lng: -84.28 },
  "30346": { lat: 33.918, lng: -84.338 },
  "30350": { lat: 33.89, lng: -84.46 },
  "30354": { lat: 33.745, lng: -84.39 },
  "30360": { lat: 33.93, lng: -84.28 },
  "30362": { lat: 33.989, lng: -84.35 },
  "30004": { lat: 34.09, lng: -84.275 },
  "30005": { lat: 34.06, lng: -84.22 },
  "30008": { lat: 33.92, lng: -84.58 },
  "30022": { lat: 34.02, lng: -84.35 },
  "30030": { lat: 33.75, lng: -84.27 },
  "30032": { lat: 33.71, lng: -84.22 },
  "30033": { lat: 33.96, lng: -84.16 },
  "30034": { lat: 33.61, lng: -84.55 },
  "30035": { lat: 33.57, lng: -84.35 },
  "30060": { lat: 33.925, lng: -84.51 },
  "30062": { lat: 33.93, lng: -84.46 },
  "30064": { lat: 33.89, lng: -84.48 },
  "30066": { lat: 33.95, lng: -84.59 },
  "30067": { lat: 33.92, lng: -84.55 },
  "30068": { lat: 33.94, lng: -84.42 },
  "30075": { lat: 33.99, lng: -84.15 },
  "30076": { lat: 33.98, lng: -84.08 },
  "30080": { lat: 33.86, lng: -84.58 },
  "30082": { lat: 33.73, lng: -84.62 },
  "30092": { lat: 33.98, lng: -84.22 },
  "30101": { lat: 33.86, lng: -84.74 },
  "30114": { lat: 34.07, lng: -84.56 },
  "30115": { lat: 34.17, lng: -84.5 },
  "30126": { lat: 33.94, lng: -84.59 },
  "30127": { lat: 33.89, lng: -84.71 },
  "30134": { lat: 33.95, lng: -84.58 },
  "30135": { lat: 33.72, lng: -84.78 },
  "30152": { lat: 33.99, lng: -84.59 },
  "30168": { lat: 33.77, lng: -84.74 },
  "30188": { lat: 33.75, lng: -84.55 },
  "30189": { lat: 34.11, lng: -84.56 },
  "30213": { lat: 33.58, lng: -84.45 },
  "30214": { lat: 33.45, lng: -84.45 },
  "30236": { lat: 33.57, lng: -84.35 },
  "30253": { lat: 33.4, lng: -84.65 },
  "30260": { lat: 33.52, lng: -84.35 },
  "30273": { lat: 33.45, lng: -84.58 },
  "30291": { lat: 33.61, lng: -84.58 },
  "30501": { lat: 34.3, lng: -83.82 },
  "30518": { lat: 34.1, lng: -83.87 },
  "30519": { lat: 34.11, lng: -83.92 },
};

/** 3-digit prefix fallback when exact ZIP is missing (rough GA / border metros). */
const PREFIX: Readonly<Record<string, { lat: number; lng: number }>> = {
  "300": { lat: 33.95, lng: -84.35 },
  "301": { lat: 33.92, lng: -84.55 },
  "302": { lat: 33.55, lng: -84.45 },
  "303": { lat: 33.76, lng: -84.39 },
  "304": { lat: 32.45, lng: -82.02 },
  "305": { lat: 34.2, lng: -83.85 },
  "306": { lat: 33.95, lng: -83.37 },
  "307": { lat: 34.95, lng: -85.2 },
  "308": { lat: 33.52, lng: -82.02 },
  "309": { lat: 33.47, lng: -82.02 },
  "310": { lat: 32.95, lng: -83.69 },
  "311": { lat: 33.75, lng: -84.47 },
  "312": { lat: 32.84, lng: -83.63 },
  "313": { lat: 32.08, lng: -81.09 },
  "314": { lat: 32.08, lng: -81.09 },
  "315": { lat: 31.58, lng: -82.0 },
  "316": { lat: 30.83, lng: -83.28 },
  "317": { lat: 31.58, lng: -84.23 },
  "318": { lat: 32.46, lng: -84.99 },
  "319": { lat: 32.46, lng: -84.99 },
};

export function normalizeUsZip5(raw: string | undefined | null): string | null {
  if (raw == null || raw === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 5) return null;
  return d.slice(0, 5);
}

export function gaZipCentroid(zip5: string): { lat: number; lng: number } | null {
  const z = ZIP5[zip5];
  if (z) return z;
  const pre = zip5.slice(0, 3);
  return PREFIX[pre] ?? null;
}
