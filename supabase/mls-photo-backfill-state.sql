-- Persist MLS photo backfill cursor for Vercel Cron (survives tab close / refresh).
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.mls_photo_backfill_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  after_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  rounds_completed integer NOT NULL DEFAULT 0,
  listings_updated bigint NOT NULL DEFAULT 0,
  last_message text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.mls_photo_backfill_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mls_photo_backfill_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mls_photo_backfill_state"
  ON public.mls_photo_backfill_state
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.mls_photo_backfill_state IS
  'Singleton row for cron-driven MLS photo backfill; updated by /api/cron/mls-photo-backfill.';
