"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, type MouseEvent } from "react";
import { siteConfig } from "@/lib/config";
import { siteContainer } from "@/lib/ui";

const ease = [0.22, 1, 0.36, 1] as const;

export function SellHero() {
  const reduceMotion = useReducedMotion();

  const scrollToForm = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("consultation");
    if (!el) return;
    const lenis = window.__lenisInstance;
    if (lenis) {
      lenis.scrollTo(el, { offset: -96 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    history.replaceState(null, "", "#consultation");
  }, []);

  const fade = (delay: number) =>
    reduceMotion
      ? undefined
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease },
        };

  return (
    <section className="relative isolate min-h-[min(72dvh,40rem)] overflow-hidden bg-[#0c1218] text-[#f2efe8] sm:min-h-[min(76dvh,44rem)]">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/video/hero-aerial-poster.jpg)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0c1218]/92 via-[#0c1218]/72 to-[#0c1218]/35"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#0c1218] via-[#0c1218]/25 to-[#0c1218]/55"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className={`${siteContainer} relative flex min-h-[min(72dvh,40rem)] flex-col justify-end pb-14 pt-6 sm:min-h-[min(76dvh,44rem)] sm:pb-16 sm:pt-8 lg:pb-20`}
      >
        <motion.p
          {...fade(0)}
          className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c8b48a]"
        >
          {siteConfig.brandSlug}
        </motion.p>

        <motion.h1
          {...fade(0.05)}
          className="mt-3 max-w-3xl text-balance text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-[0.95] tracking-tight"
        >
          Sell with
          <span className="mt-1 block font-serif text-[1.06em] font-normal italic text-[#e8dcc8]">
            a clear plan
          </span>
        </motion.h1>

        <motion.p
          {...fade(0.1)}
          className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-[#f2efe8]/75 sm:text-lg"
        >
          Pricing, prep, and marketing shaped around your timeline. Not a hard pitch.
        </motion.p>

        <motion.div
          {...fade(0.16)}
          className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <a
            href="#consultation"
            onClick={scrollToForm}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#f2efe8] px-7 py-4 text-base font-semibold text-[#0c1218] shadow-md transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] sm:px-8 sm:text-lg touch-manipulation select-none focus-ring outline-none"
          >
            Request a consultation
          </a>
          <Link
            href={`tel:${siteConfig.phoneTel}`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-[#f2efe8]/45 bg-[#f2efe8]/8 px-7 py-4 text-base font-semibold text-[#f2efe8] backdrop-blur-sm transition-colors hover:bg-[#f2efe8]/15 active:scale-[0.98] sm:px-8 sm:text-lg touch-manipulation select-none focus-ring outline-none"
          >
            Call {siteConfig.phoneDisplay}
          </Link>
        </motion.div>
      </div>

      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-8 w-full text-background sm:h-12 lg:h-14"
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
