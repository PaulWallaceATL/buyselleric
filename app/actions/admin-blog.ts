"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { slugify } from "@/lib/format";
import {
  adminGetBlogPost,
  adminListBlogPosts,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export type AdminBlogFormState = { ok: false; message: string } | null;

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
  const body = String(formData.get("body") ?? "").trim();
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
    body,
    cover_image_url,
    author,
    is_published,
    published_at: is_published ? new Date().toISOString() : null,
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
  const body = String(formData.get("body") ?? "").trim();
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
    .update({ slug, title, excerpt, body, cover_image_url, author, is_published, published_at })
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
