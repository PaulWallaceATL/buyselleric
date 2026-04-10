import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { getPublishedPosts } from "@/lib/blog-queries";
import { ctaPrimary } from "@/lib/cta-styles";
import { createMetadata } from "@/lib/metadata";
import { eyebrow, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description: `Market insights, home tips, and real estate updates from ${siteConfig.agentName}.`,
  path: "/blog",
});

export default async function BlogPage(): Promise<ReactNode> {
  const posts = await getPublishedPosts();

  return (
    <main id="main-content" className={pageMain}>
      <div className={siteContainer}>
        <p className={eyebrow}>{siteConfig.brandSlug}</p>
        <h1 className={`${sectionTitle} mt-3`}>Blog</h1>
        <p className={`${lead} mt-4`}>
          Market insights, home tips, and real estate updates from {siteConfig.agentName}.
        </p>

        {posts.length === 0 ? (
          <div className="mt-14 rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center sm:mt-16 sm:p-12">
            <p className="font-medium text-foreground">No articles yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon for market updates and homeowner tips.
            </p>
            <Link href="/" className={`${ctaPrimary} mt-6`}>
              Back to home
            </Link>
          </div>
        ) : (
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block overflow-hidden rounded-2xl border border-border/90 bg-muted/20 shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl"
              >
                {post.cover_image_url ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    <Image
                      src={post.cover_image_url}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
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
        )}
      </div>
    </main>
  );
}
