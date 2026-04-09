"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Hero = dynamic(
  () => import("@/components/hero").then((m) => ({ default: m.Hero })),
  {
    ssr: false,
    loading: () => <HeroFallback />,
  },
);

function HeroFallback() {
  return (
    <section className="relative flex min-h-dvh min-h-screen w-full items-start overflow-hidden bg-background supports-[height:100dvh]:min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex h-full min-h-[inherit] max-w-360 flex-col justify-start px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(8rem,env(safe-area-inset-top)+5rem)] text-left sm:px-12 sm:pt-36 md:pt-44 lg:px-24 lg:pt-48 xl:pt-52 2xl:max-w-450 3xl:max-w-550">
        <h1 className="text-balance text-[clamp(2.25rem,7vw,11rem)] leading-[1.06] tracking-tight text-foreground sm:text-[clamp(2.75rem,7.5vw,12rem)]">
          <span className="block">Find the home</span>
          <span className="block">that fits your life—</span>
          <span className="block">
            <em className="font-serif">or sell with a plan.</em>
          </span>
        </h1>
      </div>
    </section>
  );
}

export function HeroLoader(): ReactNode {
  return <Hero />;
}
