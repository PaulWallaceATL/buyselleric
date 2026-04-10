import Link from "next/link";
import { adminListBlogPosts, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminBlogPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const posts = client ? await adminListBlogPosts(client) : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Blog posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, edit, and publish articles.</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          New post
        </Link>
      </div>

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No blog posts yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-border rounded-2xl border border-border">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div>
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="text-sm text-muted-foreground">
                  {p.slug}
                  {p.is_published ? "" : " · draft"}
                  {p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Link
                href={`/admin/blog/${p.id}/edit`}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
