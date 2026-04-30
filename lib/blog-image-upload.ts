import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

/** Upload image bytes to the first available public blog bucket (same order as admin upload route). */
export async function uploadBlogImageBuffer(
  client: AdminClient,
  buffer: Buffer,
  contentType: string,
): Promise<{ ok: true; url: string; bucket: string } | { ok: false; error: string }> {
  const filePath = `blog/${crypto.randomUUID()}.${extFromMime(contentType)}`;
  const buckets = ["blog-images", "listing-images"] as const;
  const errors: string[] = [];

  for (const bucket of buckets) {
    const { error } = await client.storage.from(bucket).upload(filePath, buffer, {
      contentType,
      upsert: false,
    });
    if (!error) {
      const { data } = client.storage.from(bucket).getPublicUrl(filePath);
      return { ok: true, url: data.publicUrl, bucket };
    }
    errors.push(`${bucket}: ${error.message}`);
  }

  return { ok: false, error: errors.join(" | ") };
}
