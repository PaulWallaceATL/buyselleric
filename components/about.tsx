"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { siteImages } from "@/lib/site-images";
import { sectionY, siteContainer } from "@/lib/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        imageRef.current,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            end: "top 30%",
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        headingRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headingRef.current,
            start: "top 85%",
            end: "top 60%",
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        ctaRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 90%",
            end: "top 70%",
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="about" className={`bg-background ${sectionY}`}>
      <div className={`${siteContainer} flex flex-col items-center`}>
        <div
          ref={imageRef}
          className="relative mb-12 aspect-[21/9] w-full overflow-hidden rounded-3xl sm:mb-16 sm:rounded-[2rem] lg:mb-16 lg:aspect-3/1 lg:rounded-full"
        >
          <Image
            src={siteImages.aboutHero}
            alt="Modern home exterior with landscaping"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1200px"
            priority
          />
        </div>

        <h2
          ref={headingRef}
          className="mx-auto max-w-4xl text-center text-balance text-[clamp(1.5rem,4vw,2.75rem)] font-semibold leading-snug tracking-tight text-foreground sm:leading-tight"
        >
          {siteConfig.agentName} combines market data with street-level context—so you can move
          forward with confidence whether you are buying your first place or selling a long-time
          family home.
        </h2>

        <Link ref={ctaRef} href="/sell" className={`${ctaPrimary} mt-8 w-full sm:w-auto`}>
          Talk about your timeline
        </Link>
      </div>
    </section>
  );
}
