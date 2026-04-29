import { filterDisplayImageUrls } from "@/lib/listing-urls";
import type { MlsListingRow } from "@/lib/types/db";
import { absoluteResourceUrl, stripHtmlLoose, truncateMetaDescription } from "@/lib/seo";

/**
 * Google-supported RealEstateListing-style JSON-LD for MLS detail pages.
 * @see https://developers.google.com/search/docs/appearance/structured-data/real-estate-listing
 */
export function buildMlsListingJsonLd(listing: MlsListingRow, pageUrl: string, siteOrigin: string): Record<string, unknown> {
  const title = listing.title || `${listing.address_line}, ${listing.city}`.trim();
  const plainDesc = stripHtmlLoose(listing.description || "");
  const description =
    plainDesc.length >= 50
      ? truncateMetaDescription(plainDesc, 320)
      : truncateMetaDescription(
          `${title} — ${listing.city}, ${listing.state}. ${plainDesc}`.trim(),
          320,
        );

  const images = filterDisplayImageUrls(listing.image_urls)
    .slice(0, 12)
    .map((u) => absoluteResourceUrl(siteOrigin, u))
    .filter((u): u is string => Boolean(u));

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    streetAddress: listing.address_line || undefined,
    addressLocality: listing.city,
    addressRegion: listing.state,
    postalCode: listing.postal_code || undefined,
    addressCountry: "US",
  };

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    listingId: listing.mls_id,
    name: title,
    url: pageUrl,
    description,
    datePosted: listing.created_at,
    address,
    offers: {
      "@type": "Offer",
      price: listing.price_cents / 100,
      priceCurrency: "USD",
      availability: "https://schema.org/ForSale",
      url: pageUrl,
    },
  };

  if (images.length > 0) out.image = images;

  if (listing.latitude != null && listing.longitude != null) {
    out.geo = {
      "@type": "GeoCoordinates",
      latitude: listing.latitude,
      longitude: listing.longitude,
    };
  }

  if (listing.square_feet != null && listing.square_feet > 0) {
    out.floorSize = {
      "@type": "QuantitativeValue",
      value: listing.square_feet,
      unitCode: "SQF",
    };
  }

  if (listing.bedrooms > 0) {
    out.numberOfBedrooms = listing.bedrooms;
  }

  if (listing.bathrooms > 0) {
    out.numberOfBathroomsTotal = listing.bathrooms;
  }

  return out;
}
