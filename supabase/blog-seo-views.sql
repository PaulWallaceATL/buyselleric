-- Add SEO fields and view tracking to blog_posts
-- Run in Supabase → SQL → New query

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meta_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;

-- Function to atomically increment view count (called from the app)
CREATE OR REPLACE FUNCTION public.increment_blog_view(post_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = post_slug AND is_published = true;
$$;
