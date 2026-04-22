-- =============================================================================
-- MLS listings table — synced from GAMLS RETS feed
-- =============================================================================
-- Run in Supabase → SQL → New query.

CREATE TABLE IF NOT EXISTS public.mls_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_id text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'GA',
  postal_code text NOT NULL DEFAULT '',
  price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  bedrooms integer NOT NULL DEFAULT 0,
  bathrooms numeric(4,1) NOT NULL DEFAULT 0,
  square_feet integer,
  latitude double precision,
  longitude double precision,
  description text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  image_urls text[] NOT NULL DEFAULT '{}',
  listing_agent text NOT NULL DEFAULT '',
  listing_office text NOT NULL DEFAULT '',
  raw_data jsonb NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS mls_listings_city_idx ON public.mls_listings (city);
CREATE INDEX IF NOT EXISTS mls_listings_postal_idx ON public.mls_listings (postal_code);
CREATE INDEX IF NOT EXISTS mls_listings_price_idx ON public.mls_listings (price_cents);
CREATE INDEX IF NOT EXISTS mls_listings_status_idx ON public.mls_listings (status);
CREATE INDEX IF NOT EXISTS mls_listings_mls_id_idx ON public.mls_listings (mls_id);
CREATE INDEX IF NOT EXISTS mls_listings_synced_idx ON public.mls_listings (synced_at);

-- Full-text search index
CREATE INDEX IF NOT EXISTS mls_listings_search_idx ON public.mls_listings
  USING gin (to_tsvector('english', coalesce(address_line,'') || ' ' || coalesce(city,'') || ' ' || coalesce(postal_code,'') || ' ' || coalesce(title,'')));

-- Auto-update timestamp
DROP TRIGGER IF EXISTS mls_listings_set_updated_at ON public.mls_listings;
CREATE TRIGGER mls_listings_set_updated_at
  BEFORE UPDATE ON public.mls_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.mls_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active MLS listings"
  ON public.mls_listings FOR SELECT
  USING (status = 'active');

CREATE POLICY "Service role full access MLS listings"
  ON public.mls_listings
  USING (auth.role() = 'service_role');

-- Sync tracking table
CREATE TABLE IF NOT EXISTS public.mls_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  deactivated integer NOT NULL DEFAULT 0,
  total_fetched integer NOT NULL DEFAULT 0,
  error text
);

ALTER TABLE public.mls_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access sync log"
  ON public.mls_sync_log
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.mls_listings IS 'MLS listings synced from GAMLS RETS feed.';
COMMENT ON TABLE public.mls_sync_log IS 'Log of MLS sync runs.';
