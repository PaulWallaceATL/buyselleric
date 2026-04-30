-- SEO / AI agent append-only activity log (service role from app only).
-- Run in Supabase → SQL after blog tables exist.

CREATE TABLE IF NOT EXISTS public.seo_agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  kind text NOT NULL,
  summary text NOT NULL DEFAULT '',
  detail jsonb
);

CREATE INDEX IF NOT EXISTS seo_agent_activity_created_idx
  ON public.seo_agent_activity (created_at DESC);

CREATE INDEX IF NOT EXISTS seo_agent_activity_run_idx
  ON public.seo_agent_activity (run_id, created_at);

ALTER TABLE public.seo_agent_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access seo_agent_activity" ON public.seo_agent_activity;
CREATE POLICY "Service role full access seo_agent_activity"
  ON public.seo_agent_activity
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.seo_agent_activity IS 'Append-only log for the SEO AI agent heartbeat (admin UI).';
