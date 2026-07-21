import { HeroContent } from "@/components/hero";
import { HeroPoster, HeroScrim } from "@/components/hero-poster";
import type { ReactNode } from "react";

/** Server shell: LCP poster in HTML; interactive content is a client island. */
export function HeroLoader(): ReactNode {
  return (
    <section
      id="hero"
      className="hero relative min-h-dvh min-h-screen w-full overflow-hidden bg-neutral-950 supports-[height:100dvh]:min-h-[100dvh]"
    >
      <HeroPoster />
      <HeroContent />
      <HeroScrim />
    </section>
  );
}
