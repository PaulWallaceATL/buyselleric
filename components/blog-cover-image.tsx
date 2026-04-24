import type { ReactNode } from "react";

/**
 * Blog covers can point at any CDN (og:image from imports, WordPress, etc.).
 * `next/image` only allows configured hosts, so covers often failed silently.
 */
export function BlogCoverImage({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}): ReactNode {
  const trimmed = src.trim();
  if (!trimmed) return null;
  return (
    <img
      src={trimmed}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
