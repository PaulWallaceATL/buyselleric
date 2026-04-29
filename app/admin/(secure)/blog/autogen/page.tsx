import Link from "next/link";
import { AdminAutogenBlogRow } from "@/components/admin-autogen-blog-row";
import { adminListAutogenBlogPosts, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BlogPostRow } from "@/lib/types/db";
import type { ReactNode } from "react";

export default async function AdminAutogenBlogPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const posts: BlogPostRow[] = client ? await adminListAutogenBlogPosts(client) : [];
  const pending = posts.filter((p) => !p.is_published);
  const published = posts.filter((p) => p.is_published);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/blog" className="text-ring underline-offset-2 hover:underline">
              ← Blog posts
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight text-foreground">Listing-generated articles</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Posts created by the MLS listing blog job (new listings, price drops, or curated MLS IDs). Approve to
            publish, or deny to delete. Manual posts are not shown here.
          </p>
        </div>
      </div>

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">Needs review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Drafts waiting for approval or removal.</p>
            {pending.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                No pending listing-generated drafts.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {pending.map((p) => (
                  <AdminAutogenBlogRow key={p.id} post={p} />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-14">
            <h2 className="text-lg font-semibold text-foreground">Published from listings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live articles you already approved. You can edit or remove them if something looks wrong.
            </p>
            {published.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                No published listing-generated posts yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {published.map((p) => (
                  <AdminAutogenBlogRow key={p.id} post={p} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
