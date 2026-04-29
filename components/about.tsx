"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { listingImagePreferUnoptimized } from "@/lib/listing-urls";
import { siteImages } from "@/lib/site-images";
import { sectionY, siteContainer } from "@/lib/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%",
            end: "top 40%",
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        ctaRef.current,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 92%",
            end: "top 72%",
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const headshot = siteImages.ericHeadshot;

  return (
    <section ref={sectionRef} id="about" className={`bg-background ${sectionY}`}>
      <div className={`${siteContainer}`}>
        <div
          ref={contentRef}
          className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16"
        >
          <div className="lg:col-span-5">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] border border-border/80 bg-muted/30 shadow-xl shadow-foreground/5 lg:mx-0">
              <Image
                src={headshot}
                alt={`${siteConfig.agentName}, real estate agent`}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 100vw, 420px"
                loading="lazy"
                unoptimized={listingImagePreferUnoptimized(headshot)}
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ring">About</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.35rem] lg:leading-tight">
              {siteConfig.agentName}
            </h2>
            <p className="mt-2 text-lg font-medium text-muted-foreground">
              Buy with clarity. Sell with confidence—all across Georgia.
            </p>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>
                Eric is a U.S. Air Force veteran, Georgia licensed real estate salesperson (License #447520)
                with <strong className="font-medium text-foreground">Southern Classic Realty</strong>, and a
                mortgage loan officer with <strong className="font-medium text-foreground">CrossCountry Mortgage</strong>{" "}
                (NMLS #1245446). Whether you are touring homes, pricing a listing, or aligning a pre-approval with your
                offer strategy, you work with someone who understands both sides of the transaction.
              </p>
              <p>
                From first conversation to closing, Eric focuses on clear timelines, honest market context, and calm
                coordination with lenders, title partners, and attorneys—so you always know the next step.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={siteConfig.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-muted/30 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                Instagram @buyselleric
              </a>
              <a
                href={siteConfig.georgiaMlsAgentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-muted/30 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                Georgia MLS profile
              </a>
            </div>

            <Link ref={ctaRef} href="/sell" className={`${ctaPrimary} mt-10 inline-flex w-full sm:w-auto`}>
              Talk about your timeline
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
