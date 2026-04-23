"use client";

import { heroVideoConfig } from "@/lib/config";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function readSaveData(): boolean {
  if (typeof window === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

/**
 * Full-bleed hero background: lazy-loaded muted loop, poster for LCP,
 * gradient scrims so headline, search, and CTAs stay readable in light/dark.
 */
export function HeroBackgroundVideo({ tintGradient }: { tintGradient?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const saveData = useMemo(() => readSaveData(), []);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const staticBackdrop = reducedMotion || saveData;

  useEffect(() => {
    if (staticBackdrop) return;
    const root = containerRef.current;
    if (!root) return;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setInView(true);
      },
      { root: null, rootMargin: "120px 0px", threshold: 0.01 },
    );
    ob.observe(root);
    return () => ob.disconnect();
  }, [staticBackdrop]);

  useEffect(() => {
    if (staticBackdrop || !inView) return;
    const v = videoRef.current;
    if (!v) return;
    v.src = heroVideoConfig.mp4Src;
    v.load();
    void v.play().catch(() => {});
  }, [inView, staticBackdrop]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {!staticBackdrop ? (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full scale-[1.04] object-cover transition-opacity duration-[900ms] ease-out ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          poster={heroVideoConfig.posterSrc}
          muted
          playsInline
          loop
          preload="none"
          aria-hidden
          data-lenis-prevent
          onLoadedData={() => setVideoReady(true)}
        />
      ) : null}

      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500 ease-out"
        style={{
          backgroundImage: `url("${heroVideoConfig.posterSrc}")`,
          opacity: staticBackdrop || !videoReady ? 1 : 0,
        }}
        aria-hidden
      />

      {/* Readability: left-heavy + vertical vignette so copy, search, and CTAs stay legible */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "linear-gradient(to right, var(--background) 0%, color-mix(in srgb, var(--background) 88%, transparent) 40%, transparent 76%)",
            "linear-gradient(to bottom, color-mix(in srgb, var(--background) 72%, transparent) 0%, transparent 36%, color-mix(in srgb, var(--background) 90%, transparent) 100%)",
          ].join(","),
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-background/20 dark:bg-background/30" aria-hidden />

      {tintGradient ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-25 saturate-125 mix-blend-soft-light dark:opacity-20"
          style={{
            background:
              "linear-gradient(-55deg, #b8d4e6, #88b8a8, #7a9ab8, #3d5a78, #4a6b55, #5a8fa0)",
            backgroundSize: "300% 300%",
            animation: "heroGradient 12s ease infinite",
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
