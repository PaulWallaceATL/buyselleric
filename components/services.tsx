"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sectionY, siteContainer } from "@/lib/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const services = [
  { id: 1, title: "Buyer representation", href: "/services/buyer-representation" },
  { id: 2, title: "Seller marketing & prep", href: "/services/seller-marketing" },
  { id: 3, title: "Pricing & negotiation", href: "/services/pricing-negotiation" },
  { id: 4, title: "Closing coordination", href: "/services/closing-coordination" },
];

function ServiceItem({ title, href, index }: { title: string; href: string; index: number }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);

  const animationDefaults = { duration: 0.6, ease: "expo" };

  useEffect(() => {
    if (!itemRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        itemRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: itemRef.current,
            start: "top 90%",
            end: "top 70%",
            scrub: 1,
          },
        }
      );
    }, itemRef);

    return () => ctx.revert();
  }, [index]);

  const findClosestEdge = (
    mouseX: number,
    mouseY: number,
    width: number,
    height: number
  ): "top" | "bottom" => {
    const topEdgeDist = Math.pow(mouseX - width / 2, 2) + Math.pow(mouseY, 2);
    const bottomEdgeDist =
      Math.pow(mouseX - width / 2, 2) + Math.pow(mouseY - height, 2);
    return topEdgeDist < bottomEdgeDist ? "top" : "bottom";
  };

  const handleMouseEnter = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    if (!itemRef.current || !overlayRef.current || !overlayInnerRef.current)
      return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = findClosestEdge(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      rect.width,
      rect.height
    );

    const tl = gsap.timeline({ defaults: animationDefaults });
    tl.set(overlayRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .set(overlayInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0)
      .to([overlayRef.current, overlayInnerRef.current], { y: "0%" }, 0);

    if (charsRef.current.length > 0) {
      tl.fromTo(
        charsRef.current,
        { y: 0 },
        {
          y: -32,
          duration: 0.15,
          ease: "sine.out",
          stagger: { each: 0.01, from: "start" },
        },
        0
      ).to(
        charsRef.current,
        {
          y: 0,
          duration: 0.2,
          ease: "sine.inOut",
          stagger: { each: 0.01, from: "start" },
        },
        0.15
      );
    }
  };

  const handleMouseLeave = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    if (!itemRef.current || !overlayRef.current || !overlayInnerRef.current)
      return;
    const rect = itemRef.current.getBoundingClientRect();
    const edge = findClosestEdge(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      rect.width,
      rect.height
    );

    gsap.set(charsRef.current, { y: 0 });

    gsap
      .timeline({ defaults: animationDefaults })
      .to(overlayRef.current, { y: edge === "top" ? "-101%" : "101%" }, 0)
      .to(overlayInnerRef.current, { y: edge === "top" ? "101%" : "-101%" }, 0);
  };

  const chars = title.split("").map((char, i) => (
    <span
      key={i}
      ref={(el) => {
        if (el) charsRef.current[i] = el;
      }}
      className="inline-block"
      style={{ whiteSpace: char === " " ? "pre" : undefined }}
    >
      {char}
    </span>
  ));

  return (
    <div ref={itemRef} className="relative overflow-hidden border-t border-foreground/10">
      <a
        href={href}
        className="focus-ring outline-none flex min-h-[4.5rem] cursor-pointer items-center justify-between px-6 py-8 sm:px-12 md:min-h-[5rem] md:py-10 lg:px-24"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="text-[clamp(1.5rem,4vw,4rem)] font-light tracking-tight text-foreground">
          {title}
        </span>
      </a>

      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 overflow-hidden bg-foreground"
        style={{ transform: "translateY(101%)" }}
      >
        <div
          ref={overlayInnerRef}
          className="flex h-full items-center justify-between px-6 sm:px-12 lg:px-24"
          style={{ transform: "translateY(-101%)" }}
        >
          <span className="text-[clamp(1.5rem,4vw,4rem)] font-light tracking-tight text-background">
            {chars}
          </span>
          <svg
            className="h-8 w-8 text-background md:h-12 md:w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 17L17 7M17 7H7M17 7V17"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function Services() {
  return (
    <section
      id="services"
      className={`services relative scroll-mt-28 overflow-hidden bg-background sm:scroll-mt-32 ${sectionY}`}
    >
      <div className={`${siteContainer} mb-10 sm:mb-14`}>
        <h2 className="max-w-3xl text-balance text-[clamp(1.75rem,4.5vw,3.25rem)] font-medium leading-[1.15] tracking-tight text-foreground">
          Guidance for buyers. Strategy for sellers. Calm at every step.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          From first tour to closing day—clear advice, steady advocacy, and a plan that fits how you
          buy or sell.
        </p>
      </div>

      <div id="services-menu" className="w-full scroll-mt-28 sm:scroll-mt-32">
        <div className="w-full">
          {services.map((service, index) => (
            <ServiceItem key={service.id} title={service.title} href={service.href} index={index} />
          ))}
          <div className="border-t border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
