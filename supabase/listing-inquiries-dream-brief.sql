-- =============================================================================
-- Dream preference brief columns on listing_inquiries (Phase 4)
-- =============================================================================
-- Run in Supabase → SQL → New query.

ALTER TABLE public.listing_inquiries
  ADD COLUMN IF NOT EXISTS dream_brief text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dream_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS shortlist_mls_ids text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.listing_inquiries.dream_brief IS
  'Plain-language preference summary from dream-home Share with Eric.';
COMMENT ON COLUMN public.listing_inquiries.dream_filters IS
  'Structured hard/soft/amenity filters at share time.';
COMMENT ON COLUMN public.listing_inquiries.shortlist_mls_ids IS
  'Top result MLS ids the buyer shortlisted from dream search.';
