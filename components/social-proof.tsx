"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { siteImages } from "@/lib/site-images";
import { eyebrow, sectionTitle, sectionY, siteContainer } from "@/lib/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 17L17 7M17 7H7M17 7V17"
      />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
    </svg>
  );
}

export function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            end: "top 50%",
            scrub: 1,
          },
        }
      );

      const cards = gridRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 80, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: gridRef.current,
              start: "top 80%",
              end: "top 40%",
              scrub: 1,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="social-proof" className={`bg-background ${sectionY}`}>
      <div className={siteContainer}>
        <div
          ref={headerRef}
          className="mb-10 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between lg:mb-16"
        >
          <div className="min-w-0">
            <p className={eyebrow}>Stories</p>
            <h2 className={`${sectionTitle} mt-3 max-w-md`}>Clients who made a move</h2>
          </div>
          <Link href="/listings" className={`${ctaPrimary} w-full shrink-0 sm:w-auto`}>
            See homes
          </Link>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[minmax(200px,auto)_minmax(200px,auto)_minmax(160px,auto)]"
        >
          <div className="row-span-2 flex flex-col gap-4">
            <div className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-2xl sm:min-h-[220px] sm:rounded-3xl">
              <Image
                src={siteImages.testimonialLiving}
                alt="Bright open-plan living and dining area"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
            </div>
            <div className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-2xl sm:min-h-[220px] sm:rounded-3xl lg:rounded-full">
              <Image
                src={siteImages.testimonialExterior}
                alt="Contemporary home with pool at dusk"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border/60 bg-muted/40 p-6 sm:rounded-3xl sm:p-8 lg:col-span-2 lg:row-span-2">
            <div>
              <QuoteIcon className="w-10 h-10 text-foreground/20 mb-6" />
              <blockquote className="text-pretty text-xl font-medium leading-snug text-foreground sm:text-2xl lg:text-3xl">
                Eric helped us win in a multiple-offer situation without overpaying—and kept us
                sane through inspection surprises.
              </blockquote>
              <div className="mt-6">
                <p className="font-semibold text-foreground">Jordan &amp; Sam Rivera</p>
                <p className="text-sm text-foreground/60">First-time buyers</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-8">
              <span className="text-xl font-semibold text-foreground">{siteConfig.primaryMarket}</span>
              <Link
                href="/listings"
                className="min-h-12 min-w-12 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <ArrowIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border/60 bg-muted/40 p-6 sm:rounded-3xl">
            <div className="flex-1">
              <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">18 days</p>
              <p className="text-sm text-foreground/60 mt-1">Average time to accepted offer (sample)</p>
            </div>
            <div className="flex items-center justify-between mt-auto pt-4">
              <span className="text-sm font-medium text-foreground">Seller story</span>
              <Link
                href="/sell"
                className="min-h-12 min-w-12 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <ArrowIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border/60 bg-muted/40 p-6 sm:rounded-3xl">
            <div className="flex-1">
              <p className="text-2xl font-semibold text-foreground sm:text-3xl">100%</p>
              <p className="text-sm text-foreground/60 mt-1">Paperwork explained before you sign</p>
            </div>
            <div className="flex items-center justify-between mt-auto pt-4">
              <span className="text-sm font-medium text-foreground">Clarity</span>
              <Link
                href="/#contact"
                className="min-h-12 min-w-12 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <ArrowIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border/60 bg-muted/40 p-6 sm:rounded-3xl sm:p-8">
            <div className="flex-1">
              <p className="text-2xl font-semibold text-foreground sm:text-3xl lg:text-4xl">5-star care</p>
              <p className="text-foreground/60 mt-2">
                Communication that
                <br />
                matches your pace
              </p>
            </div>
            <div className="mt-auto pt-6">
              <p className="text-sm font-medium text-foreground">Referrals welcome</p>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border/60 bg-muted/40 p-6 sm:rounded-3xl sm:p-8 lg:col-span-3">
            <p className="max-w-3xl flex-1 text-pretty text-lg font-medium leading-relaxed text-foreground sm:text-xl lg:text-2xl">
              We sold above asking after Eric&apos;s staging checklist and pricing strategy. The
              whole team felt informed at every step.
            </p>
            <div className="flex items-center justify-between mt-auto pt-6">
              <span className="text-xl font-semibold text-foreground">The Okonkwo family</span>
              <Link
                href="/sell"
                className="min-h-12 min-w-12 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <ArrowIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
