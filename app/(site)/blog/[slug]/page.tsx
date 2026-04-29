import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCoverImage } from "@/components/blog-cover-image";
import { BlogViewTracker } from "@/components/blog-view-tracker";
import { siteConfig } from "@/lib/config";
import { defaultSocialImage } from "@/lib/metadata";
import { getPublishedPostBySlug } from "@/lib/blog-queries";
import { renderBlogBodyMarkdown } from "@/lib/blog-markdown";
import { absoluteResourceUrl, truncateMetaDescription } from "@/lib/seo";
import { innerPageMainTopPadding, pageMain, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) {
    return {
      title: "Article",
      robots: { index: false, follow: false },
    };
  }

  const rawDesc = post.meta_description?.trim() || post.excerpt || `Read "${post.title}" by ${post.author}`;
  const description = truncateMetaDescription(rawDesc);
  const displayKeywords = [
    ...new Set(post.seo_keywords?.map((k) => k.replace(/^#+/, "").trim()).filter(Boolean) ?? []),
  ];
  const keywords = displayKeywords.length ? displayKeywords.slice(0, 24) : undefined;
  const url = `${siteConfig.url}/blog/${slug}`;
  const ogFallback =
    absoluteResourceUrl(siteConfig.url, defaultSocialImage.url) ?? `${siteConfig.url}${defaultSocialImage.url}`;
  const ogImageUrl =
    absoluteResourceUrl(siteConfig.url, post.cover_image_url?.trim() || null) ?? ogFallback;

  return {
    title: post.title,
    description,
    keywords,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at ?? undefined,
      authors: [post.author],
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }]
        : [{ ...defaultSocialImage, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({ params }: Props): Promise<ReactNode> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const pageUrl = `${siteConfig.url}/blog/${slug}`;
  const jsonLdDesc = truncateMetaDescription(post.meta_description?.trim() || post.excerpt || post.title);
  const jsonLdImage = absoluteResourceUrl(siteConfig.url, post.cover_image_url?.trim() || null);
  const displayKeywords = [
    ...new Set(post.seo_keywords?.map((k) => k.replace(/^#+/, "").trim()).filter(Boolean) ?? []),
  ];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: jsonLdDesc,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(post.updated_at ? { dateModified: post.updated_at } : {}),
    ...(jsonLdImage ? { image: jsonLdImage } : {}),
    ...(displayKeywords.length ? { keywords: displayKeywords.slice(0, 20).join(", ") } : {}),
  };

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogViewTracker slug={slug} />

      <article className={`${siteContainer} max-w-3xl`}>
        <Link href="/blog" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back to blog
        </Link>

        <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {post.title}
        </h1>

        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{post.author}</span>
          {post.published_at && (
            <>
              <span>·</span>
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </>
          )}
        </div>

        {displayKeywords.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {displayKeywords.map((kw) => (
              <span key={kw} className="rounded-full bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                {kw}
              </span>
            ))}
          </div>
        )}

        {post.cover_image_url?.trim() ? (
          <div className="relative mt-8 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted sm:rounded-3xl">
            <BlogCoverImage
              src={post.cover_image_url}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
              priority
            />
          </div>
        ) : null}

        <div
          className="prose prose-lg mt-10 max-w-none space-y-6 [--tw-prose-body:var(--muted-foreground)] [--tw-prose-headings:var(--foreground)] [--tw-prose-bold:var(--foreground)] [--tw-prose-bullets:var(--muted-foreground)] [--tw-prose-counters:var(--muted-foreground)] [--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--border)] [--tw-prose-hr:var(--border)] prose-headings:tracking-tight prose-headings:scroll-mt-24 prose-h2:mb-4 prose-h2:mt-10 prose-h3:mb-3 prose-h3:mt-8 prose-a:text-ring prose-a:underline-offset-4 prose-p:mb-4 prose-p:mt-0 prose-p:last:mb-0 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 [&_.blog-deck]:not-prose [&_.blog-deck]:mb-3 [&_.blog-deck]:mt-10 [&_.blog-deck]:text-foreground"
          dangerouslySetInnerHTML={{ __html: renderBlogBodyMarkdown(post.body) }}
        />

        <div className="mt-16 border-t border-border pt-8">
          <Link href="/blog" className="text-sm font-semibold text-ring underline-offset-4 hover:underline">
            ← More articles
          </Link>
        </div>
      </article>
    </main>
  );
}

