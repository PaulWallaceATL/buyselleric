-- Keyset pagination for listings that need MLS photos (empty or null image_urls).
-- Uses listing UUID id for ordering (safe); not mls_id string sort.
-- Run in Supabase SQL editor once.

DROP FUNCTION IF EXISTS public.mls_listings_missing_photos_batch(int, text);
DROP FUNCTION IF EXISTS public.mls_listings_missing_photos_batch(int, uuid);

CREATE OR REPLACE FUNCTION public.mls_listings_missing_photos_batch(
  p_limit int DEFAULT 40,
  p_after_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
)
RETURNS TABLE(id uuid, mls_id text)
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.mls_id
  FROM public.mls_listings l
  WHERE l.status = 'active'
    AND (l.image_urls IS NULL OR cardinality(l.image_urls) = 0)
    AND (
      p_after_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR l.id > p_after_id
    )
  ORDER BY l.id
  LIMIT greatest(1, least(p_limit, 200));
$$;

COMMENT ON FUNCTION public.mls_listings_missing_photos_batch IS
  'Next page of active MLS listings with no photos (keyset on id).';

GRANT EXECUTE ON FUNCTION public.mls_listings_missing_photos_batch(int, uuid) TO anon, authenticated, service_role;
