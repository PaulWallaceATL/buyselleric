import { uploadBlogImageBuffer } from "@/lib/blog-image-upload";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSeoAgentOpenAI } from "@/lib/seo-agent/openai-client";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export async function generateSeoCoverImage(
  client: AdminClient,
  title: string,
  excerpt: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const openai = getSeoAgentOpenAI();
    const prompt = `Wide editorial photograph for a real estate blog hero image. Theme: ${title}. Subtle context: ${excerpt.slice(0, 240)}. Style: warm natural light, Georgia residential architecture or tree-lined neighborhood, cinematic, high-end editorial. No text, no logos, no watermark, no people's faces in sharp focus.`;

    const img = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 3900),
      size: "1792x1024",
      quality: "standard",
      n: 1,
    });

    const url = img.data?.[0]?.url;
    if (!url) return { ok: false, error: "No image URL from OpenAI" };

    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Image download failed: ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.includes("png") ? "image/png" : "image/png";
    const upload = await uploadBlogImageBuffer(client, buf, mime);
    if (!upload.ok) return { ok: false, error: upload.error };
    return { ok: true, url: upload.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
