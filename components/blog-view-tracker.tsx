"use client";

import { useEffect } from "react";

export function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `blog-view-${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/blog/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {});
  }, [slug]);

  return null;
}
