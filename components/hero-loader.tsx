"use client";

import { HeroSearch } from "@/components/hero-search";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { siteConfig } from "@/lib/config";
import { ctaMortgage, ctaPrimary, ctaSecondary } from "@/lib/cta-styles";

function useIsMobile(breakpoint = 768): boolean | null {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    setMobile(window.innerWidth < breakpoint);
  }, [breakpoint]);
  return mobile;
}

function HeroFallback({ showGradient }: { showGradient?: boolean }) {
  return (
    <section
      id="hero"
      className="hero relative min-h-dvh min-h-screen w-full overflow-hidden bg-background supports-[height:100dvh]:min-h-[100dvh]"
    >
      {showGradient && <CSSGradientBackground />}
      <HeroContent />
    </section>
  );
}

function CSSGradientBackground() {
  return (
    <div
      className="absolute inset-0 z-0 opacity-40 saturate-125 md:opacity-70"
      style={{
        background:
          "linear-gradient(-55deg, #b8d4e6, #88b8a8, #7a9ab8, #3d5a78, #4a6b55, #5a8fa0)",
        backgroundSize: "300% 300%",
        animation: "heroGradient 12s ease infinite",
      }}
    />
  );
}

function HeroContent() {
  return (
    <div className="relative z-10 mx-auto flex h-full min-h-[inherit] max-w-360 flex-col justify-center px-6 pb-[max(5rem,env(safe-area-inset-bottom)+2rem)] pt-[max(6rem,env(safe-area-inset-top)+4rem)] text-left sm:px-12 sm:pt-28 md:pb-24 lg:px-24 lg:pt-32 2xl:max-w-450 3xl:max-w-550">
      <h1 className="text-balance text-[clamp(2.25rem,7vw,11rem)] leading-[1.06] tracking-tight text-foreground sm:text-[clamp(2.75rem,7.5vw,12rem)]">
        <span className="block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.3s_both]" style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}>Find the home</span>
        <span className="block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.5s_both]" style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}>that fits your life—</span>
        <span className="block animate-[heroReveal_1.6s_cubic-bezier(0.22,1,0.36,1)_0.7s_both]" style={{ transformOrigin: "center bottom", transformStyle: "preserve-3d" }}>
          <em className="font-serif">or sell with a plan.</em>
        </span>
      </h1>
      <p className="mt-4 max-w-md text-pretty text-[clamp(1rem,2.5vw,1.45rem)] leading-relaxed text-foreground/85 sm:mt-6 lg:max-w-lg 2xl:max-w-xl animate-[heroFadeUp_1s_cubic-bezier(0.25,1,0.5,1)_1.2s_both]">
        Eric Adams is your partner for buying and selling real estate—local insight, honest
        pricing conversations, and hands-on support from tour to keys.
      </p>
      <div className="mt-6 animate-[heroFadeUp_0.8s_cubic-bezier(0.25,1,0.5,1)_1.3s_both] sm:mt-8">
        <HeroSearch />
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-4 animate-[heroFadeUp_0.8s_cubic-bezier(0.25,1,0.5,1)_1.5s_both]">
        <Link href="/listings" className={ctaPrimary}>
          View listings
        </Link>
        <Link href="/sell" className={ctaSecondary}>
          Sell your home
        </Link>
        <a href={siteConfig.mortgageApplicationUrl} target="_blank" rel="noopener noreferrer" className={ctaMortgage}>
          Apply now
        </a>
        <a href={siteConfig.mortgageApplicationUrl} target="_blank" rel="noopener noreferrer" className={ctaMortgage}>
          Refinance
        </a>
      </div>
    </div>
  );
}

export function HeroLoader(): ReactNode {
  const isMobile = useIsMobile();
  const [HeroComponent, setHeroComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (isMobile === null) return;
    if (isMobile) return;

    let cancelled = false;

    const load = () => {
      if (cancelled) return;
      import("@/components/hero").then((mod) => {
        if (!cancelled) {
          setHeroComponent(() => mod.Hero);
        }
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    } else {
      const timer = setTimeout(load, 1500);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [isMobile]);

  if (isMobile === null) {
    return <HeroFallback />;
  }

  if (isMobile) {
    return <HeroFallback showGradient />;
  }

  if (HeroComponent) {
    return <HeroComponent />;
  }

  return <HeroFallback showGradient />;
}
