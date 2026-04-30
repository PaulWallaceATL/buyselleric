import Link from "next/link";
import { AdminBlogQuickActions } from "@/components/admin-blog-quick-actions";
import { AdminDuplicateBlogButton } from "@/components/admin-duplicate-blog-button";
import { adminListBlogPosts, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BlogPostKind } from "@/lib/types/db";
import type { ReactNode } from "react";

const KIND_LABEL: Record<BlogPostKind, string> = {
  manual: "Manual",
  agent_seo: "AI SEO",
  curated: "Curated listing",
  new_listing: "New listing",
  price_drop: "Price drop",
};

const KIND_TONE: Record<BlogPostKind, string> = {
  manual: "bg-muted/40 text-muted-foreground",
  agent_seo: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  curated: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  new_listing: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  price_drop: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
};

const AUTOGEN_KINDS: BlogPostKind[] = ["curated", "new_listing", "price_drop", "agent_seo"];

export default async function AdminBlogPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const posts = client ? await adminListBlogPosts(client) : [];

  const totalViews = posts.reduce((sum, p) => sum + (p.view_count ?? 0), 0);
  const publishedCount = posts.filter((p) => p.is_published).length;
  const draftCount = posts.length - publishedCount;
  const aiCount = posts.filter((p) => AUTOGEN_KINDS.includes(p.post_kind)).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Blog posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All posts in one place — manual, AI SEO drafts, and listing-driven articles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/seo-agent"
            className="rounded-full border border-border bg-muted/30 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            AI SEO agent
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
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI / listing</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{aiCount}</p>
          </div>
        </div>
      )}

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No blog posts yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {posts.map((p) => {
            const isAutogen = AUTOGEN_KINDS.includes(p.post_kind);
            const kindLabel = KIND_LABEL[p.post_kind] ?? "Manual";
            const kindTone = KIND_TONE[p.post_kind] ?? KIND_TONE.manual;

            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${kindTone}`}>
                      {kindLabel}
                    </span>
                    {p.is_published ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-200">
                        Draft
                      </span>
                    )}
                    {p.source_mls_id ? (
                      <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        MLS {p.source_mls_id}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-medium text-foreground">{p.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {p.slug}
                    {p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString()}` : ""}
                    {!p.is_published && !p.published_at
                      ? ` · created ${new Date(p.created_at).toLocaleDateString()}`
                      : ""}
                  </p>
                  {p.seo_keywords?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.seo_keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                      {p.seo_keywords.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{p.seo_keywords.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {(p.view_count ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">views</p>
                  </div>
                  <AdminDuplicateBlogButton postId={p.id} />
                  {p.is_published ? (
                    <Link
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/blog/${p.id}/edit`}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Edit
                  </Link>
                  <AdminBlogQuickActions
                    postId={p.id}
                    isPublished={p.is_published}
                    isAutogen={isAutogen}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
