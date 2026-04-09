"use client";

import { useEffect, type ReactNode } from "react";
import { features } from "@/lib/config";

export function SmoothScroll({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    if (!features.smoothScroll) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      import("lenis").then(({ default: Lenis }) => {
        if (cancelled) return;

        const lenis = new Lenis({
          duration: 1.6,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: "vertical" as const,
          gestureOrientation: "vertical" as const,
          smoothWheel: true,
          wheelMultiplier: 1,
          touchMultiplier: 2,
        });

        function raf(time: number) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        function handleAnchorClick(e: MouseEvent) {
          const target = e.target as HTMLElement;
          const anchor = target.closest('a[href^="#"]');
          if (!anchor) return;

          const href = anchor.getAttribute("href");
          if (!href) return;

          e.preventDefault();

          if (href === "#") {
            lenis.scrollTo(0, { offset: 0 });
            return;
          }

          if (href === "#contact") {
            const contact = document.getElementById("contact");
            if (contact) {
              lenis.scrollTo(contact, { offset: -24 });
              return;
            }
            lenis.scrollTo("bottom", { offset: 0 });
            return;
          }

          const element = document.querySelector(href);
          if (!element) return;
          lenis.scrollTo(element as HTMLElement, { offset: -100 });
        }

        document.addEventListener("click", handleAnchorClick);

        window.__lenisCleanup = () => {
          document.removeEventListener("click", handleAnchorClick);
          lenis.destroy();
        };
      });
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.__lenisCleanup?.();
    };
  }, []);

  return <>{children}</>;
}

declare global {
  interface Window {
    __lenisCleanup?: () => void;
  }
}
