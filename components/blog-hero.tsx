"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import Link from "next/link";
import { Suspense, useRef, type MouseEvent } from "react";
import { BlogCoverImage } from "@/components/blog-cover-image";
import { BlogSearchBar } from "@/components/blog-search-bar";
import { siteConfig } from "@/lib/config";
import { siteContainer } from "@/lib/ui";

export type BlogHeroTile = {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string;
};

type BlogHeroProps = {
  tiles: BlogHeroTile[];
  searchDefault?: string;
};

export function BlogHero({ tiles, searchDefault = "" }: BlogHeroProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 140, damping: 24, mass: 0.35 });
  const springY = useSpring(my, { stiffness: 140, damping: 24, mass: 0.35 });

  const spotlightX = useTransform(springX, [-1, 1], ["20%", "80%"]);
  const spotlightY = useTransform(springY, [-1, 1], ["25%", "75%"]);
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${spotlightX} ${spotlightY}, rgba(242,239,232,0.16), transparent 58%)`;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = gridRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }

  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  const a = tiles[0];
  const b = tiles[1];
  const c = tiles[2];
  const d = tiles[3];
  const e = tiles[4];

  return (
    <section className="relative isolate overflow-hidden bg-[#0c1218] text-[#f2efe8]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_20%,rgba(90,140,170,0.22),transparent_55%),radial-gradient(ellipse_70%_50%_at_85%_10%,rgba(200,160,90,0.12),transparent_50%),linear-gradient(180deg,#0c1218_0%,#121a22_55%,#0f1419_100%)]"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{ background: spotlight }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className={`${siteContainer} relative pb-16 pt-2 sm:pb-20 sm:pt-4 lg:pb-24`}>
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <div className="lg:col-span-5">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c8b48a]"
            >
              {siteConfig.brandSlug}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-balance text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-[0.95] tracking-tight text-[#f2efe8]"
            >
              Stories from
              <span className="mt-1 block font-serif text-[1.05em] font-normal italic text-[#e8dcc8]">
                the field
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#f2efe8]/70 sm:text-lg"
            >
              Market insight, home tips, and real estate updates from {siteConfig.agentName} for
              Georgia buyers and sellers.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-md [&_form]:max-w-none [&_div]:border-[#f2efe8]/15 [&_div]:bg-[#f2efe8]/08 [&_input]:text-[#f2efe8] [&_input]:placeholder:text-[#f2efe8]/45 [&_svg]:text-[#f2efe8]/55 [&_button]:bg-[#f2efe8] [&_button]:text-[#0c1218]"
            >
              <Suspense>
                <BlogSearchBar defaultValue={searchDefault} />
              </Suspense>
            </motion.div>
          </div>

          <div
            ref={gridRef}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            className="relative lg:col-span-7"
          >
            <div className="grid min-h-[22rem] grid-cols-12 grid-rows-6 gap-2.5 sm:min-h-[26rem] sm:gap-3 lg:min-h-[30rem]">
              {a ? (
                <BentoTile
                  post={a}
                  className="col-span-7 row-span-4 rounded-[1.35rem] sm:rounded-[1.75rem]"
                  x={springX}
                  y={springY}
                  strength={16}
                  priority
                />
              ) : (
                <PlaceholderTile className="col-span-7 row-span-4 rounded-[1.35rem] sm:rounded-[1.75rem]" />
              )}
              {b ? (
                <BentoTile
                  post={b}
                  className="col-span-5 row-span-2 rounded-[1.2rem] sm:rounded-[1.5rem]"
                  x={springX}
                  y={springY}
                  strength={-11}
                />
              ) : (
                <PlaceholderTile className="col-span-5 row-span-2 rounded-[1.2rem]" />
              )}
              {c ? (
                <BentoTile
                  post={c}
                  className="col-span-5 row-span-2 rounded-[1.2rem] sm:rounded-[1.5rem]"
                  x={springX}
                  y={springY}
                  strength={12}
                />
              ) : (
                <PlaceholderTile className="col-span-5 row-span-2 rounded-[1.2rem]" />
              )}
              {d ? (
                <BentoTile
                  post={d}
                  className="col-span-4 row-span-2 rounded-[1.15rem] sm:rounded-[1.4rem]"
                  x={springX}
                  y={springY}
                  strength={-9}
                />
              ) : (
                <PlaceholderTile className="col-span-4 row-span-2 rounded-[1.15rem]" />
              )}
              {e ? (
                <BentoTile
                  post={e}
                  className="col-span-8 row-span-2 rounded-[1.25rem] sm:rounded-[1.55rem]"
                  x={springX}
                  y={springY}
                  strength={9}
                />
              ) : (
                <div className="col-span-8 row-span-2 flex items-end rounded-[1.25rem] border border-[#f2efe8]/12 bg-[#f2efe8]/05 p-5 sm:rounded-[1.55rem] sm:p-6">
                  <p className="max-w-sm text-sm leading-relaxed text-[#f2efe8]/75 sm:text-base">
                    Fresh notes from showings, pricing conversations, and closings across Georgia.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-10 w-full text-background sm:h-14 lg:h-16"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          d="M0,40 C240,80 480,0 720,32 C960,64 1200,8 1440,40 L1440,80 L0,80 Z"
        />
      </svg>
    </section>
  );
}

function BentoTile({
  post,
  className,
  x,
  y,
  strength,
  priority,
}: {
  post: BlogHeroTile;
  className: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
  strength: number;
  priority?: boolean;
}) {
  const offsetX = useTransform(x, (v) => v * strength);
  const offsetY = useTransform(y, (v) => v * strength * 0.65);

  return (
    <div className={`group relative overflow-hidden ${className}`}>
      <Link
        href={`/blog/${post.slug}`}
        className="absolute inset-0 block focus-ring outline-none"
        aria-label={post.title}
      >
        <motion.div
          className="absolute inset-[-8%]"
          style={{ x: offsetX, y: offsetY }}
        >
          <BlogCoverImage
            src={post.cover_image_url}
            alt=""
            {...(priority ? { priority: true } : {})}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-white drop-shadow sm:text-sm">
            {post.title}
          </p>
        </div>
      </Link>
    </div>
  );
}

function PlaceholderTile({ className }: { className: string }) {
  return (
    <div className={`border border-[#f2efe8]/10 bg-[#f2efe8]/[0.04] ${className}`} aria-hidden />
  );
}
