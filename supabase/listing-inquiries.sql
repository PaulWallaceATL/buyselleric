-- Buyer / listing inquiries (request showing, ask about a home)
create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null default '',
  message text not null default '',
  preferred_times text not null default '',
  listing_source text not null default ''
    check (listing_source in ('', 'manual', 'mls')),
  listing_id text not null default '',
  listing_title text not null default '',
  listing_path text not null default '',
  admin_status text not null default 'new'
    check (admin_status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists listing_inquiries_created_idx
  on public.listing_inquiries (created_at desc);

create index if not exists listing_inquiries_status_idx
  on public.listing_inquiries (admin_status);

alter table public.listing_inquiries enable row level security;

create policy "Public insert listing inquiries"
  on public.listing_inquiries
  for insert
  to anon, authenticated
  with check (true);

comment on table public.listing_inquiries is
  'Inbound buyer leads from listing detail request-showing forms.';
