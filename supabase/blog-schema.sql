-- =============================================================================
-- Blog posts table for BuySellEric
-- =============================================================================
-- Run in Supabase → SQL → New query.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  cover_image_url text,
  author text not null default 'Eric Adams',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (is_published, published_at desc)
  where is_published = true;

create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- RLS: public can read published posts, service role has full access
alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (is_published = true);

drop policy if exists "Service role has full access to blog posts" on public.blog_posts;
create policy "Service role has full access to blog posts"
  on public.blog_posts
  using (auth.role() = 'service_role');
