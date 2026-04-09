"use client";

import { useEffect, useState, type ReactNode } from "react";

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
    <div className="relative z-10 mx-auto flex h-full min-h-[inherit] max-w-360 flex-col justify-start px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(8rem,env(safe-area-inset-top)+5rem)] text-left sm:px-12 sm:pt-36 md:pt-44 lg:px-24 lg:pt-48 xl:pt-52 2xl:max-w-450 3xl:max-w-550">
      <h1 className="text-balance text-[clamp(2.25rem,7vw,11rem)] leading-[1.06] tracking-tight text-foreground sm:text-[clamp(2.75rem,7.5vw,12rem)]">
        <span className="block">Find the home</span>
        <span className="block">that fits your life—</span>
        <span className="block">
          <em className="font-serif">or sell with a plan.</em>
        </span>
      </h1>
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
