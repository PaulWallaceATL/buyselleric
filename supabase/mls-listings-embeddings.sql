-- =============================================================================
-- MLS listing embeddings (dream-home Phase 3 hybrid ranking)
-- =============================================================================
-- Run in Supabase → SQL → New query.
-- Requires pgvector (available on Supabase by default).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.mls_listings
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS embed_text_hash text;

CREATE INDEX IF NOT EXISTS mls_listings_embedding_hnsw_idx
  ON public.mls_listings
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS mls_listings_embed_null_idx
  ON public.mls_listings (synced_at DESC)
  WHERE embedding IS NULL AND status = 'active';

-- Cosine similarity for a candidate MLS id set (dream rerank, not full-corpus ANN).
CREATE OR REPLACE FUNCTION public.match_listing_embeddings(
  query_embedding vector(1536),
  candidate_mls_ids text[],
  match_count int DEFAULT 100
)
RETURNS TABLE (mls_id text, similarity double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.mls_id,
    (1 - (l.embedding <=> query_embedding))::double precision AS similarity
  FROM public.mls_listings l
  WHERE l.mls_id = ANY (candidate_mls_ids)
    AND l.embedding IS NOT NULL
    AND l.status = 'active'
  ORDER BY l.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 200));
$$;

COMMENT ON FUNCTION public.match_listing_embeddings IS
  'Dream-home Phase 3: cosine similarity for candidate mls_ids only.';
