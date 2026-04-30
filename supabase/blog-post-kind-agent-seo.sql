-- Extend blog_posts.post_kind for AI SEO agent longform drafts.
-- Run after listing-blog-schema.sql.

ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_post_kind_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_post_kind_check
  CHECK (post_kind IN ('manual', 'curated', 'new_listing', 'price_drop', 'agent_seo'));
