"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { siteContainer } from "@/lib/ui";

const ease = [0.22, 1, 0.36, 1] as const;

export function SellHero() {
  return (
    <section className="relative isolate min-h-[min(88dvh,52rem)] overflow-hidden bg-[#0c1218] text-[#f2efe8]">
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
        className={`${siteContainer} relative flex min-h-[min(88dvh,52rem)] flex-col justify-end pb-16 pt-8 sm:pb-20 sm:pt-10 lg:pb-24`}
      >
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c8b48a]"
        >
          {siteConfig.brandSlug}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.06, ease }}
          className="mt-4 max-w-3xl text-balance text-[clamp(2.75rem,8vw,5.5rem)] font-semibold leading-[0.95] tracking-tight"
        >
          Sell with
          <span className="mt-1 block font-serif text-[1.06em] font-normal italic text-[#e8dcc8]">
            a clear plan
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14, ease }}
          className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-[#f2efe8]/75 sm:text-lg"
        >
          Pricing, prep, and marketing shaped around your timeline. Not a hard pitch.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22, ease }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <a
            href="#consultation"
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
