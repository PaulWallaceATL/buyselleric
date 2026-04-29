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

        const HEADER_OFFSET = -120;

        function scrollToHashIfPresent() {
          const h = window.location.hash;
          if (!h || h === "#") return;
          const el = document.querySelector(h);
          if (el) lenis.scrollTo(el as HTMLElement, { offset: HEADER_OFFSET });
        }

        /** Same-origin in-page anchors, including `/#section` on the homepage. */
        function handleAnchorClick(e: MouseEvent) {
          const a = (e.target as HTMLElement | null)?.closest("a");
          if (!a || a.tagName !== "A") return;
          const raw = a.getAttribute("href");
          if (!raw) return;

          if (raw === "#") {
            e.preventDefault();
            lenis.scrollTo(0, { offset: 0 });
            history.replaceState(null, "", window.location.pathname);
            return;
          }

          if (raw === "#contact") {
            e.preventDefault();
            const contact = document.getElementById("contact");
            if (contact) lenis.scrollTo(contact, { offset: -24 });
            else lenis.scrollTo("bottom", { offset: 0 });
            return;
          }

          let hash = "";
          if (raw.startsWith("#")) {
            hash = raw;
          } else if (raw.startsWith("/#")) {
            hash = raw.slice(1);
          } else {
            try {
              const u = new URL(raw, window.location.origin);
              if (u.origin !== window.location.origin) return;
              if (u.pathname !== "/" || !u.hash) return;
              hash = u.hash;
            } catch {
              return;
            }
          }

          if (!hash || hash === "#") return;

          if (window.location.pathname !== "/") {
            return;
          }

          const element = document.querySelector(hash);
          if (!element) return;

          e.preventDefault();
          lenis.scrollTo(element as HTMLElement, { offset: HEADER_OFFSET });
          history.replaceState(null, "", `${window.location.pathname}${hash}`);
        }

        document.addEventListener("click", handleAnchorClick);

        window.__lenisCleanup = () => {
          document.removeEventListener("click", handleAnchorClick);
          lenis.destroy();
        };

        [0, 50, 150, 400, 900, 1800].forEach((ms) => {
          setTimeout(() => {
            if (cancelled) return;
            scrollToHashIfPresent();
          }, ms);
        });
      });
    }, 200);

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
