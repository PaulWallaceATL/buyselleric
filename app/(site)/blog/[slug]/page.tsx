import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BlogViewTracker } from "@/components/blog-view-tracker";
import { siteConfig } from "@/lib/config";
import { getPublishedPostBySlug } from "@/lib/blog-queries";
import { siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};

  const description = post.meta_description || post.excerpt || `Read "${post.title}" by ${post.author}`;
  const keywords = post.seo_keywords?.length ? post.seo_keywords : undefined;
  const url = `${siteConfig.url}/blog/${slug}`;

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
      authors: [post.author],
      ...(post.cover_image_url ? { images: [{ url: post.cover_image_url, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: post.cover_image_url ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(post.cover_image_url ? { images: [post.cover_image_url] } : {}),
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || post.excerpt,
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: siteConfig.name },
    datePublished: post.published_at,
    dateModified: post.updated_at,
    url: `${siteConfig.url}/blog/${slug}`,
    ...(post.cover_image_url ? { image: post.cover_image_url } : {}),
    ...(post.seo_keywords?.length ? { keywords: post.seo_keywords.join(", ") } : {}),
  };

  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background pb-24 pt-24 sm:pb-28 sm:pt-28 lg:pt-32">
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

        {post.cover_image_url && (
          <div className="relative mt-8 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted sm:rounded-3xl">
            <Image
              src={post.cover_image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          </div>
        )}

        <div
          className="prose prose-lg prose-foreground mt-10 max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-ring prose-a:underline-offset-4"
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

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}
