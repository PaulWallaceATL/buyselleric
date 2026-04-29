"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { siteContainer } from "@/lib/ui";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function SplitText({ children }: { children: string }) {
  return (
    <>
      {children.split(" ").map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {word.split("").map((char, ci) => (
            <span key={ci} className="char inline-block">
              {char}
            </span>
          ))}
          {wi < children.split(" ").length - 1 && (
            <span className="char inline-block">&nbsp;</span>
          )}
        </span>
      ))}
    </>
  );
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
        { y: 28, opacity: 0 },
        {
          y: 0,
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
    <div
      ref={itemRef}
      className="relative h-full min-h-[11.5rem] overflow-hidden rounded-2xl border border-foreground/15 bg-muted/5 sm:min-h-[12.5rem]"
    >
      <a
        href={href}
        className="focus-ring outline-none flex h-full min-h-[11.5rem] cursor-pointer flex-col items-center justify-center px-4 py-6 text-center sm:min-h-[12.5rem] sm:px-5 sm:py-8"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="text-balance text-lg font-medium leading-snug tracking-tight text-foreground sm:text-xl lg:text-2xl">
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
          className="flex h-full flex-col items-center justify-center gap-4 px-4 py-6 sm:px-5"
          style={{ transform: "translateY(-101%)" }}
        >
          <span className="text-balance text-center text-lg font-medium leading-snug tracking-tight text-background sm:text-xl lg:text-2xl">
            {chars}
          </span>
          <svg
            className="h-8 w-8 shrink-0 text-background sm:h-9 sm:w-9"
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
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!titleRef.current || !sectionRef.current || !contentRef.current) return;

    const title = titleRef.current;
    const chars = title.querySelectorAll(".char");
    const section = sectionRef.current;
    const content = contentRef.current;

    gsap.fromTo(
      chars,
      {
        willChange: "transform",
        transformOrigin: "50% 100%",
        scaleY: 0,
      },
      {
        ease: "power3.in",
        opacity: 1,
        scaleY: 1,
        stagger: 0.05,
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=150%",
          scrub: true,
          pin: content,
          anticipatePin: 1,
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="services"
      className="services relative scroll-mt-28 overflow-hidden bg-background sm:scroll-mt-32"
    >
      <div
        ref={contentRef}
        className="flex min-h-screen items-center justify-center px-6 sm:px-12 lg:px-24"
      >
        <h2
          ref={titleRef}
          className="text-center text-[clamp(2.5rem,7vw,7rem)] font-medium leading-[1.1] tracking-tight text-foreground max-w-350"
        >
          <SplitText>Guidance for buyers. Strategy for sellers. Calm at every step.</SplitText>
        </h2>
      </div>

      <div id="services-menu" className="w-full scroll-mt-28 border-t border-foreground/10 pb-24 pt-12 sm:scroll-mt-32 sm:pt-16">
        <div className={siteContainer}>
          <h3
            id="services-heading"
            className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-ring sm:text-sm"
          >
            SERVICES
          </h3>
          <div
            className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-2 justify-items-stretch gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6"
            role="list"
            aria-labelledby="services-heading"
          >
            {services.map((service, index) => (
              <div key={service.id} className="h-full" role="listitem">
                <ServiceItem title={service.title} href={service.href} index={index} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
