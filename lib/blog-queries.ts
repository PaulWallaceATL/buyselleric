import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BlogPostRow } from "@/lib/types/db";

export async function getPublishedPosts(): Promise<BlogPostRow[]> {
  const { posts } = await getPublishedPostsPaginated({ page: 1, perPage: 10_000 });
  return posts;
}

export interface PublishedPostsPage {
  posts: BlogPostRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getPublishedPostsPaginated(options: {
  page?: number | undefined;
  perPage?: number | undefined;
  q?: string | undefined;
}): Promise<PublishedPostsPage> {
  const supabase = await createSupabaseServerClient();
  const perPage = Math.min(50, Math.max(1, options.perPage ?? 10));
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  if (!supabase) {
    return { posts: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  let query = supabase
    .from("blog_posts")
    .select("*", { count: "exact" })
    .eq("is_published", true);

  const titleQ = options.q?.trim();
  if (titleQ) {
    const term = titleQ.replace(/[%_,]/g, " ").trim();
    if (term) query = query.ilike("title", `%${term}%`);
  }

  const { data, error, count } = await query
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("getPublishedPostsPaginated", error.message);
    return { posts: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  return {
    posts: (data ?? []) as BlogPostRow[],
    total,
    page: safePage,
    perPage,
    totalPages,
  };
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPostRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("getPublishedPostBySlug", error.message);
    return null;
  }
  return data as BlogPostRow | null;
}
