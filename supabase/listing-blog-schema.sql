-- Listing-driven blog posts + MLS price-drop signals
-- Run in Supabase → SQL (or supabase db execute) after blog-seo-views.sql.

-- Blog post provenance (manual rows keep post_kind = manual, source_mls_id null)
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS source_mls_id text,
  ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_post_kind_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_post_kind_check
      CHECK (post_kind IN ('manual', 'curated', 'new_listing', 'price_drop'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blog_posts_source_mls_id_idx
  ON public.blog_posts (source_mls_id)
  WHERE source_mls_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_one_new_listing_per_mls
  ON public.blog_posts (source_mls_id)
  WHERE post_kind = 'new_listing' AND source_mls_id IS NOT NULL;

-- Append-only price reductions detected during RETS sync (deduped per mls + new price)
CREATE TABLE IF NOT EXISTS public.mls_listing_price_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_id text NOT NULL,
  from_price_cents bigint NOT NULL,
  to_price_cents bigint NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  blog_post_id uuid REFERENCES public.blog_posts (id) ON DELETE SET NULL,
  CONSTRAINT mls_listing_price_events_drop CHECK (to_price_cents < from_price_cents)
);

CREATE UNIQUE INDEX IF NOT EXISTS mls_listing_price_events_mls_to_price_uniq
  ON public.mls_listing_price_events (mls_id, to_price_cents);

CREATE INDEX IF NOT EXISTS mls_listing_price_events_pending_idx
  ON public.mls_listing_price_events (detected_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.mls_listing_price_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access listing price events" ON public.mls_listing_price_events;
CREATE POLICY "Service role full access listing price events"
  ON public.mls_listing_price_events
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.mls_listing_price_events IS 'Price drops observed during MLS sync; consumed by listing-blog cron.';
COMMENT ON COLUMN public.blog_posts.source_mls_id IS 'MLS listing id when post was generated from mls_listings.';
COMMENT ON COLUMN public.blog_posts.post_kind IS 'manual | curated | new_listing | price_drop';
