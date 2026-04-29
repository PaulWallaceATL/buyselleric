import Link from "next/link";
import { AdminDuplicateBlogButton } from "@/components/admin-duplicate-blog-button";
import { adminListBlogPosts, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminBlogPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const posts = client ? await adminListBlogPosts(client) : [];

  const totalViews = posts.reduce((sum, p) => sum + (p.view_count ?? 0), 0);
  const publishedCount = posts.filter((p) => p.is_published).length;
  const draftCount = posts.length - publishedCount;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Blog posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, edit, and publish articles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/blog/autogen"
            className="rounded-full border border-border bg-muted/30 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Listing blog queue
          </Link>
          <Link
            href="/admin/blog/new"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            New post
          </Link>
        </div>
      </div>

      {client && posts.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total views</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalViews.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Published</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{publishedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Drafts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{draftCount}</p>
          </div>
        </div>
      )}

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No blog posts yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.slug}
                  {p.is_published ? "" : " · draft"}
                  {p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString()}` : ""}
                </p>
                {p.seo_keywords?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.seo_keywords.slice(0, 4).map((kw) => (
                      <span key={kw} className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {kw}
                      </span>
                    ))}
                    {p.seo_keywords.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{p.seo_keywords.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {(p.view_count ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">views</p>
                </div>
                <AdminDuplicateBlogButton postId={p.id} />
                <Link
                  href={`/admin/blog/${p.id}/edit`}
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
