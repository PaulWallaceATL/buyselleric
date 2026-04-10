-- Storage policies for listing-images bucket
-- Run in Supabase → SQL → New query
-- The service_role key bypasses RLS for uploads, but public read
-- access requires an explicit SELECT policy.

-- Public read access for listing-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read listing-images'
  ) THEN
    CREATE POLICY "Public read listing-images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'listing-images');
  END IF;
END
$$;

-- Allow authenticated + service role to upload to listing-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow upload listing-images'
  ) THEN
    CREATE POLICY "Allow upload listing-images"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'listing-images');
  END IF;
END
$$;

-- Allow delete from listing-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete listing-images'
  ) THEN
    CREATE POLICY "Allow delete listing-images"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'listing-images');
  END IF;
END
$$;
