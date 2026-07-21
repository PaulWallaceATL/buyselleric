-- Add separate listing agent / broker phone columns for IDX attribution.
-- Run in Supabase → SQL → New query after mls-listings-schema.sql.

ALTER TABLE public.mls_listings
  ADD COLUMN IF NOT EXISTS listing_agent_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS listing_office_phone text NOT NULL DEFAULT '';
