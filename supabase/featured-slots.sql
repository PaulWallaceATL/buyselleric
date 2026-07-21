-- Homepage featured slots (hybrid: MLS pick or manual listing).
-- Run in Supabase → SQL → New query.

CREATE TABLE IF NOT EXISTS public.featured_slots (
  slot_index smallint PRIMARY KEY CHECK (slot_index BETWEEN 1 AND 3),
  source text NOT NULL CHECK (source IN ('mls', 'manual')),
  mls_id text,
  listing_id uuid REFERENCES public.listings (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_slots_source_refs CHECK (
    (source = 'mls' AND mls_id IS NOT NULL AND btrim(mls_id) <> '' AND listing_id IS NULL)
    OR (source = 'manual' AND listing_id IS NOT NULL AND mls_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS featured_slots_listing_id_idx
  ON public.featured_slots (listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS featured_slots_mls_id_idx
  ON public.featured_slots (mls_id)
  WHERE mls_id IS NOT NULL;

DROP TRIGGER IF EXISTS featured_slots_set_updated_at ON public.featured_slots;
CREATE TRIGGER featured_slots_set_updated_at
  BEFORE UPDATE ON public.featured_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.featured_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read featured slots"
  ON public.featured_slots FOR SELECT
  USING (true);

CREATE POLICY "Service role full access featured slots"
  ON public.featured_slots
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.featured_slots IS 'Curated homepage featured homes — each slot is MLS or manual.';
