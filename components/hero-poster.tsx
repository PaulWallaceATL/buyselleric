import { siteImages } from "@/lib/site-images";
import type { ReactNode } from "react";

/** Server-rendered LCP poster — must stay out of client components so it ships in HTML. */
export function HeroPoster(): ReactNode {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-950" aria-hidden>
      <img
        src={siteImages.heroPoster}
        alt=""
        width={960}
        height={540}
        fetchPriority="high"
        decoding="sync"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

/** Readability scrim above poster/video so white text stays WCAG-safe. */
export function HeroScrim(): ReactNode {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/35" />
    </div>
  );
}
