import Link from "next/link";
import { Suspense } from "react";
import { BlogCoverImage } from "@/components/blog-cover-image";
import { BlogPagination } from "@/components/blog-pagination";
import { BlogSearchBar } from "@/components/blog-search-bar";
import { siteConfig } from "@/lib/config";
import { getPublishedPostsPaginated } from "@/lib/blog-queries";
import { ctaPrimary } from "@/lib/cta-styles";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description: `Market insights, home tips, and real estate updates from ${siteConfig.agentName}.`,
  path: "/blog",
});

function parseNum(val: string | string[] | undefined): number | undefined {
  if (typeof val !== "string") return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = parseNum(params.page) ?? 1;
  const perPage = 10;

  const { posts, total, totalPages, page: safePage } = await getPublishedPostsPaginated({
    q: q || undefined,
    page,
    perPage,
  });

  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;

  const itemListJsonLd =
    posts.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: posts.map((p, i) => ({
            "@type": "ListItem",
            position: (safePage - 1) * perPage + i + 1,
            url: `${siteConfig.url}/blog/${p.slug}`,
            name: p.title,
          })),
        }
      : null;

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      <div className={siteContainer}>
        <p className={eyebrow}>{siteConfig.brandSlug}</p>
        <h1 className={`${sectionTitle} mt-3`}>Blog</h1>
        <p className={`${lead} mt-4`}>
          Market insights, home tips, and real estate updates from {siteConfig.agentName}.
        </p>

        <div className="mt-8">
          <Suspense>
            <BlogSearchBar defaultValue={q} />
          </Suspense>
        </div>

        {q ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {total === 0
              ? `No articles matching “${q}”.`
              : `${total.toLocaleString()} ${total === 1 ? "article" : "articles"} matching “${q}”.`}
          </p>
        ) : null}

        {posts.length === 0 ? (
          <div className="mt-14 rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center sm:mt-16 sm:p-12">
            <p className="font-medium text-foreground">
              {q ? "No articles match your search" : "No articles yet."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {q
                ? "Try a different title keyword or clear the search."
                : "Check back soon for market updates and homeowner tips."}
            </p>
            {q ? (
              <Link href="/blog" className={`${ctaPrimary} mt-6`}>
                View all articles
              </Link>
            ) : (
              <Link href="/" className={`${ctaPrimary} mt-6`}>
                Back to home
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-border/90 bg-muted/20 shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl"
                >
                  {post.cover_image_url?.trim() ? (
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                      <BlogCoverImage
                        src={post.cover_image_url}
                        alt={post.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted/40">
                      <span className="text-sm text-muted-foreground">No cover image</span>
                    </div>
                  )}
                  <div className="p-5 sm:p-6">
                    <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      {post.title}
                    </p>
                    {post.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{post.author}</span>
                      {post.published_at && (
                        <>
                          <span>·</span>
                          <time dateTime={post.published_at}>
                            {new Date(post.published_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </time>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <BlogPagination
              page={safePage}
              totalPages={totalPages}
              total={total}
              baseParams={baseParams}
            />
          </>
        )}
      </div>
    </main>
  );
}
