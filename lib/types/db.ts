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

export type BlogPostKind = "manual" | "curated" | "new_listing" | "price_drop" | "agent_seo";

export type SeoAgentActivityLevel = "info" | "warn" | "error";

export type SeoAgentActivityKind =
  | "run_start"
  | "run_end"
  | "skipped"
  | "web_research"
  | "topic_selected"
  | "blog_draft_created"
  | "listing_post_created"
  | "listing_post_skipped"
  | "cover_generated"
  | "error_step";

export interface SeoAgentActivityRow {
  id: string;
  created_at: string;
  run_id: string;
  level: SeoAgentActivityLevel;
  kind: SeoAgentActivityKind | string;
  summary: string;
  detail: Record<string, unknown> | null;
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
  source_mls_id: string | null;
  post_kind: BlogPostKind;
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
  listing_agent_phone: string;
  listing_office: string;
  listing_office_phone: string;
  raw_data: Record<string, unknown>;
  synced_at: string;
  created_at: string;
  updated_at: string;
  /** Dream Phase 3 — pgvector embedding metadata (optional until backfill). */
  embedding_model?: string | null;
  embedding_updated_at?: string | null;
  embed_text_hash?: string | null;
}

export type FeaturedSlotSource = "mls" | "manual";

export interface FeaturedSlotRow {
  slot_index: number;
  source: FeaturedSlotSource;
  mls_id: string | null;
  listing_id: string | null;
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

export interface ListingInquiryRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  message: string;
  preferred_times: string;
  listing_source: "" | "manual" | "mls";
  listing_id: string;
  listing_title: string;
  listing_path: string;
  admin_status: SellSubmissionAdminStatus;
  created_at: string;
  /** Dream Phase 4 preference brief (optional until SQL applied). */
  dream_brief?: string;
  dream_filters?: Record<string, unknown>;
  shortlist_mls_ids?: string[];
}
