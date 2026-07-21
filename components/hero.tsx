"use client";

import { HeroSearch } from "@/components/hero-search";
import { siteConfig } from "@/lib/config";
import { siteImages } from "@/lib/site-images";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HERO_VIDEO_SRC = "/video/hero-aerial.mp4";
const HERO_POSTER_SRC = siteImages.heroPoster;

const ctaPrimaryOnVideo =
  "inline-flex min-h-[52px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-base font-semibold text-neutral-950 shadow-md transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] sm:px-8 sm:text-lg touch-manipulation select-none focus-ring outline-none";

const ctaSecondaryOnVideo =
  "inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-[0.98] sm:px-8 sm:text-lg touch-manipulation select-none focus-ring outline-none";

const ctaMortgageOnVideo =
  "inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-white/45 bg-black/25 px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/35 active:scale-[0.98] sm:px-8 sm:text-lg touch-manipulation select-none focus-ring outline-none";

function shouldLoadHeroVideo(): boolean {
  if (typeof window === "undefined") return false;
  // Still respect a11y + extreme bandwidth — but play on mobile (user prefers video over PSI).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return false;
  return true;
}

/** Video overlay after idle — poster stays server-rendered for LCP. Plays on mobile too. */
function HeroVideoOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    if (!shouldLoadHeroVideo()) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => {
      if (!cancelled) setLoadVideo(true);
    };

    // Mobile: start sooner so the aerial isn't stuck on the still for long.
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      timeoutId = setTimeout(enable, 200);
    } else if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 1800 });
    } else {
      timeoutId = setTimeout(enable, 900);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!loadVideo) return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      void video.play().catch(() => {});
    };

    tryPlay();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadVideo]);

  if (!loadVideo) return null;

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 z-[1] h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster={HERO_POSTER_SRC}
      aria-hidden
    >
      <source src={HERO_VIDEO_SRC} type="video/mp4" />
    </video>
  );
}

export function HeroContent(): ReactNode {
  return (
    <>
      <HeroVideoOverlay />
      <div
        className="relative z-10 mx-auto flex h-full min-h-[inherit] max-w-360 flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom)+1rem)] pt-[max(5.5rem,env(safe-area-inset-top)+3.5rem)] text-left sm:px-12 sm:pt-24 md:pb-16 lg:px-24 lg:pt-28 2xl:max-w-450 3xl:max-w-550"
        style={{ perspective: "1200px" }}
      >
        <h1 className="text-balance text-[clamp(2rem,6.5vw,10rem)] leading-[1.06] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-[clamp(2.5rem,7vw,11rem)]">
          <span className="block overflow-hidden pb-[0.1em]">
            <span
              className="hero-anim-reveal block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.3s_both]"
              style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}
            >
              Find the home
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.1em]">
            <span
              className="hero-anim-reveal block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.5s_both]"
              style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}
            >
              that fits your life
            </span>
          </span>
          <span className="block overflow-hidden pb-[0.1em]">
            <span
              className="hero-anim-reveal block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.7s_both]"
              style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}
            >
              <em className="font-serif">or sell with a plan.</em>
            </span>
          </span>
        </h1>

        <p className="hero-anim-fade mt-3 max-w-md text-pretty text-[clamp(0.95rem,2.3vw,1.35rem)] leading-relaxed text-white drop-shadow-sm sm:mt-5 lg:max-w-lg 2xl:max-w-xl animate-[heroFadeUp_1s_cubic-bezier(0.25,1,0.5,1)_1.2s_both]">
          Eric Adams is your partner for buying and selling real estate local insight, honest
          pricing conversations, and hands-on support from tour to keys.
        </p>
        <div className="hero-anim-fade relative z-[70] mt-4 animate-[heroFadeUp_0.8s_cubic-bezier(0.25,1,0.5,1)_1.3s_both] sm:mt-5">
          <HeroSearch />
        </div>
        <div className="hero-anim-fade hero-ctas relative z-10 mt-3 flex flex-row flex-wrap gap-2 sm:mt-4 sm:gap-3 animate-[heroFadeUp_0.8s_cubic-bezier(0.25,1,0.5,1)_1.5s_both]">
          <Link href="/listings" className={ctaPrimaryOnVideo}>
            View listings
          </Link>
          <Link href="/sell" className={ctaSecondaryOnVideo}>
            Sell your home
          </Link>
          <a
            href={siteConfig.mortgageApplicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={ctaMortgageOnVideo}
          >
            Get pre-approved
          </a>
          <a
            href={siteConfig.mortgageApplicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ctaMortgageOnVideo} hidden sm:inline-flex`}
          >
            Refinance
          </a>
        </div>
      </div>
    </>
  );
}
