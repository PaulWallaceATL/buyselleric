export type ListingStatus = "draft" | "available" | "pending" | "sold";

export type SellSubmissionAdminStatus = "new" | "in_progress" | "closed";

export interface ListingRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  is_published: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author: string;
  seo_keywords: string[];
  meta_description: string;
  view_count: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MlsListingRow {
  id: string;
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
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MlsSyncLogRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  inserted: number;
  updated: number;
  deactivated: number;
  total_fetched: number;
  error: string | null;
}

export interface SellSubmissionRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  property_address: string;
  city: string;
  state: string;
  postal_code: string;
  property_type: string;
  timeline: string;
  message: string;
  admin_status: SellSubmissionAdminStatus;
  created_at: string;
}
