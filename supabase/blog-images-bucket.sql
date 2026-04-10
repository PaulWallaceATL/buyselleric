-- Create a public storage bucket for blog cover images
-- Run in Supabase → SQL → New query

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can read blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

-- Allow service role to upload
CREATE POLICY "Service role can upload blog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog-images');

-- Allow service role to delete
CREATE POLICY "Service role can delete blog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog-images');
