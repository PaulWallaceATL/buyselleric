import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCoverImage } from "@/components/blog-cover-image";
import { BlogViewTracker } from "@/components/blog-view-tracker";
import { siteConfig } from "@/lib/config";
import { defaultSocialImage } from "@/lib/metadata";
import { getPublishedPostBySlug } from "@/lib/blog-queries";
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
  const keywords = post.seo_keywords?.length ? post.seo_keywords.slice(0, 24) : undefined;
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
    ...(post.seo_keywords?.length ? { keywords: post.seo_keywords.slice(0, 20).join(", ") } : {}),
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

        {post.seo_keywords?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.seo_keywords.map((kw) => (
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
          className="prose prose-lg prose-foreground mt-10 max-w-none space-y-6 dark:prose-invert prose-headings:tracking-tight prose-headings:scroll-mt-24 prose-h2:mb-4 prose-h2:mt-10 prose-h3:mb-3 prose-h3:mt-8 prose-a:text-ring prose-a:underline-offset-4 prose-p:mb-4 prose-p:mt-0 prose-p:last:mb-0 prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
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

/** Inline emphasis / links (used after block structure is known). */
function applyInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

/**
 * Turn editor body into valid HTML: blank lines = new paragraphs; single newlines = &lt;br /&gt; inside one &lt;p&gt;.
 * (The old regex inserted raw &lt;/p&gt;&lt;p&gt; then wrapped whole lines in &lt;p&gt;, producing invalid nested &lt;p&gt; and collapsed spacing in browsers.)
 */
function renderMarkdown(md: string): string {
  const trimmed = md.trim();
  if (!trimmed) return "";

  const blocks = trimmed.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];

  for (const block of blocks) {
    const nonEmpty = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (nonEmpty.length === 0) continue;

    const first = nonEmpty[0]!;

    const m3 = first.match(/^###\s+(.+)$/);
    const m2 = first.match(/^##\s+(.+)$/);
    const m1 = first.match(/^#\s+(.+)$/);

    if (m3 && nonEmpty.length === 1) {
      out.push(`<h3>${applyInlineMarkdown(m3[1]!)}</h3>`);
      continue;
    }
    if (m2 && nonEmpty.length === 1) {
      out.push(`<h2>${applyInlineMarkdown(m2[1]!)}</h2>`);
      continue;
    }
    if (m1 && nonEmpty.length === 1) {
      out.push(`<h1>${applyInlineMarkdown(m1[1]!)}</h1>`);
      continue;
    }

    // Heading with following lines in the same block (no blank line after heading in source)
    if (m3 && nonEmpty.length > 1) {
      out.push(`<h3>${applyInlineMarkdown(m3[1]!)}</h3>`);
      out.push(`<p>${nonEmpty.slice(1).map(applyInlineMarkdown).join("<br />")}</p>`);
      continue;
    }
    if (m2 && nonEmpty.length > 1) {
      out.push(`<h2>${applyInlineMarkdown(m2[1]!)}</h2>`);
      out.push(`<p>${nonEmpty.slice(1).map(applyInlineMarkdown).join("<br />")}</p>`);
      continue;
    }
    if (m1 && nonEmpty.length > 1) {
      out.push(`<h1>${applyInlineMarkdown(m1[1]!)}</h1>`);
      out.push(`<p>${nonEmpty.slice(1).map(applyInlineMarkdown).join("<br />")}</p>`);
      continue;
    }

    const allBullets = nonEmpty.every((l) => l.startsWith("- "));
    if (allBullets) {
      const items = nonEmpty.map((l) => `<li>${applyInlineMarkdown(l.replace(/^-\s+/, ""))}</li>`).join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    out.push(`<p>${nonEmpty.map(applyInlineMarkdown).join("<br />")}</p>`);
  }

  return out.join("\n");
}
