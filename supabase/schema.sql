-- BuySellEric — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL) after creating a project.

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Listings (homes for sale / portfolio)
-- -----------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  price_cents bigint not null check (price_cents >= 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms numeric(4, 1) not null default 0 check (bathrooms >= 0),
  square_feet integer check (square_feet is null or square_feet >= 0),
  address_line text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  status text not null default 'available'
    check (status in ('draft', 'available', 'pending', 'sold')),
  is_published boolean not null default false,
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_published_idx
  on public.listings (is_published, status)
  where is_published = true;

create index if not exists listings_slug_idx on public.listings (slug);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sell-your-home inquiries
-- -----------------------------------------------------------------------------
create table if not exists public.sell_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null default '',
  property_address text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  property_type text not null default '',
  timeline text not null default '',
  message text not null default '',
  admin_status text not null default 'new'
    check (admin_status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists sell_submissions_created_idx
  on public.sell_submissions (created_at desc);

create index if not exists sell_submissions_status_idx
  on public.sell_submissions (admin_status);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.sell_submissions enable row level security;

-- Public can read published listings (drafts hidden)
create policy "Public read published listings"
  on public.listings
  for select
  to anon, authenticated
  using (is_published = true);

-- Public can submit sell forms (insert only)
create policy "Public insert sell submissions"
  on public.sell_submissions
  for insert
  to anon, authenticated
  with check (true);

-- Service role bypasses RLS — use the service role key only on the server (admin
-- API routes / server actions). Do not expose it in the browser.

-- Optional: if you later add Supabase Auth for admins, replace service-role usage
-- with authenticated policies for a dedicated admin role.

comment on table public.listings is 'Real estate listings managed via admin panel.';
comment on table public.sell_submissions is 'Inbound leads from the sell-your-home form.';
