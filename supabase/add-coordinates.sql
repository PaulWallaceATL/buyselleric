-- Add latitude/longitude columns to listings table for map view
-- Run in Supabase → SQL → New query

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Backfill coordinates for demo listings (approximate GA locations)
UPDATE public.listings SET latitude = 33.7748, longitude = -84.2963 WHERE slug = 'demo-oakridge-colonial';
UPDATE public.listings SET latitude = 33.7841, longitude = -84.3832 WHERE slug = 'demo-midtown-loft';
UPDATE public.listings SET latitude = 33.9526, longitude = -84.5499 WHERE slug = 'demo-sunset-terrace-ranch';
UPDATE public.listings SET latitude = 34.0754, longitude = -84.2941 WHERE slug = 'demo-lakeview-estate';
UPDATE public.listings SET latitude = 34.0234, longitude = -84.3616 WHERE slug = 'demo-riverside-townhome';
