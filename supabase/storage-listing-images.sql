-- Listing photos: one public bucket. Uploads use the service role from server actions (bypasses RLS).
-- Run in the Supabase SQL Editor (or migrate) after your main schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read objects in this bucket (required for public URLs on the marketing site).
drop policy if exists "Public read listing-images" on storage.objects;
create policy "Public read listing-images"
on storage.objects for select
to public
using (bucket_id = 'listing-images');

-- No insert/update/delete policies for anon or authenticated users: only the service role uploads.
