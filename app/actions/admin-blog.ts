"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { stripHashtagSpamFromMarkdownBody } from "@/lib/blog-markdown";
import { slugify } from "@/lib/format";
import { truncateMetaDescription } from "@/lib/seo";
import {
  adminGetBlogPost,
  adminListBlogPosts,
  createSupabaseAdminClient,
  isAutogenBlogKind,
} from "@/lib/supabase/admin";

export type AdminBlogFormState = { ok: false; message: string } | null;

/** Strip # prefixes and duplicates; keeps display-friendly keywords only. */
function normalizeSeoKeywordsFromForm(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    const t = k.replace(/^#+/, "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

async function requireAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    throw new Error("Unauthorized");
  }
}

export async function adminSaveBlogPost(
  prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  const postId = String(formData.get("post_id") ?? "").trim();
  if (postId) {
    return adminUpdateBlogPost(postId, prev, formData);
  }
  return adminCreateBlogPost(prev, formData);
}

async function adminCreateBlogPost(
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const title = String(formData.get("title") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const meta_description_raw = String(formData.get("meta_description") ?? "").trim();
  const meta_description = truncateMetaDescription(meta_description_raw || excerpt);
  const seo_keywords_raw = String(formData.get("seo_keywords") ?? "").trim();
  const seo_keywords = normalizeSeoKeywordsFromForm(
    seo_keywords_raw ? seo_keywords_raw.split(",").map((k) => k.trim()).filter(Boolean) : [],
  );
  const body = stripHashtagSpamFromMarkdownBody(String(formData.get("body") ?? "")).trim();
  const cover_image_url = String(formData.get("cover_image_url") ?? "").trim() || null;
  const author = String(formData.get("author") ?? "Eric Adams").trim();
  const is_published = formData.get("is_published") === "on";

  if (!title) return { ok: false, message: "Title is required." };
  if (!body) return { ok: false, message: "Body is required." };

  if (!slug) slug = slugify(title);

  let finalSlug = slug;
  const existing = await adminListBlogPosts(client);
  const slugs = new Set(existing.map((p) => p.slug));
  let n = 0;
  while (slugs.has(finalSlug)) {
    n += 1;
    finalSlug = `${slug}-${n}`;
  }

  const { error } = await client.from("blog_posts").insert({
    slug: finalSlug,
    title,
    excerpt,
    meta_description,
    seo_keywords,
    body,
    cover_image_url,
    author,
    is_published,
    published_at: is_published ? new Date().toISOString() : null,
    source_mls_id: null,
    post_kind: "manual",
  });

  if (error) {
    console.error("adminCreateBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

async function adminUpdateBlogPost(
  id: string,
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const current = await adminGetBlogPost(client, id);
  if (!current) return { ok: false, message: "Post not found." };

  const title = String(formData.get("title") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const meta_description_raw = String(formData.get("meta_description") ?? "").trim();
  const meta_description = truncateMetaDescription(meta_description_raw || excerpt);
  const seo_keywords_raw = String(formData.get("seo_keywords") ?? "").trim();
  const seo_keywords = normalizeSeoKeywordsFromForm(
    seo_keywords_raw ? seo_keywords_raw.split(",").map((k) => k.trim()).filter(Boolean) : [],
  );
  const body = stripHashtagSpamFromMarkdownBody(String(formData.get("body") ?? "")).trim();
  const cover_image_url = String(formData.get("cover_image_url") ?? "").trim() || null;
  const author = String(formData.get("author") ?? "Eric Adams").trim();
  const is_published = formData.get("is_published") === "on";

  if (!title) return { ok: false, message: "Title is required." };
  if (!body) return { ok: false, message: "Body is required." };

  if (!slug) slug = slugify(title);

  if (slug !== current.slug) {
    const { data: clash } = await client.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (clash && (clash as { id: string }).id !== id) {
      return { ok: false, message: "That slug is already in use." };
    }
  }

  const published_at =
    is_published && !current.published_at
      ? new Date().toISOString()
      : is_published
        ? current.published_at
        : null;

  const { error } = await client
    .from("blog_posts")
    .update({ slug, title, excerpt, meta_description, seo_keywords, body, cover_image_url, author, is_published, published_at })
    .eq("id", id);

  if (error) {
    console.error("adminUpdateBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${current.slug}`);
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}/edit`);
  redirect("/admin/blog");
}

export async function adminDeleteBlogPostForm(
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };
  return adminDeleteBlogPost(id);
}

export async function adminDuplicateBlogPost(
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };

  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const source = await adminGetBlogPost(client, id);
  if (!source) return { ok: false, message: "Post not found." };

  const baseSlug = slugify(`Copy ${source.title}`);
  let finalSlug = baseSlug;
  const existing = await adminListBlogPosts(client);
  const slugs = new Set(existing.map((p) => p.slug));
  let n = 0;
  while (slugs.has(finalSlug)) {
    n += 1;
    finalSlug = `${baseSlug}-${n}`;
  }

  const { error } = await client.from("blog_posts").insert({
    slug: finalSlug,
    title: `Copy — ${source.title}`,
    excerpt: source.excerpt,
    meta_description: truncateMetaDescription(source.meta_description || source.excerpt),
    seo_keywords: source.seo_keywords,
    body: source.body,
    cover_image_url: source.cover_image_url,
    author: source.author,
    is_published: false,
    published_at: null,
    source_mls_id: null,
    post_kind: "manual",
  });

  if (error) {
    console.error("adminDuplicateBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

export async function adminApproveAutogenBlogPost(
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const post = await adminGetBlogPost(client, id);
  if (!post) return { ok: false, message: "Post not found." };

  if (!isAutogenBlogKind(post.post_kind)) {
    return { ok: false, message: "This post is not an auto-generated listing article." };
  }

  if (post.is_published) {
    return { ok: false, message: "That post is already published." };
  }

  const published_at = new Date().toISOString();
  const { error } = await client.from("blog_posts").update({ is_published: true, published_at }).eq("id", id);

  if (error) {
    console.error("adminApproveAutogenBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin/blog");
  revalidatePath("/admin/blog/autogen");
  redirect("/admin/blog/autogen");
}

export async function adminRejectAutogenBlogPost(
  _prev: AdminBlogFormState,
  formData: FormData,
): Promise<AdminBlogFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const post = await adminGetBlogPost(client, id);
  if (!post) return { ok: false, message: "Post not found." };

  if (!isAutogenBlogKind(post.post_kind)) {
    return { ok: false, message: "This post is not an auto-generated listing article." };
  }

  const slug = post.slug;
  const { error } = await client.from("blog_posts").delete().eq("id", id);

  if (error) {
    console.error("adminRejectAutogenBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
  revalidatePath("/admin/blog/autogen");
  redirect("/admin/blog/autogen");
}

export async function adminDeleteBlogPost(id: string): Promise<AdminBlogFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const { error } = await client.from("blog_posts").delete().eq("id", id);
  if (error) {
    console.error("adminDeleteBlogPost", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024;
const BLOG_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function blogImageExt(contentType: string): string {
  switch (contentType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "bin";
  }
}

export async function adminUploadBlogImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, message: "Supabase admin is not configured." };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { ok: false, message: "No file uploaded." };
  if (file.size > MAX_BLOG_IMAGE_BYTES) return { ok: false, message: "Image must be 5 MB or smaller." };
  if (!BLOG_IMAGE_MIME.has(file.type)) return { ok: false, message: "Use JPEG, PNG, WebP, or GIF." };

  const ext = blogImageExt(file.type);
  const path = `blog/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from("listing-images").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("adminUploadBlogImage bucket=listing-images path=" + path, error.message);
    return { ok: false, message: `Storage error: ${error.message}` };
  }

  const { data } = client.storage.from("listing-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
