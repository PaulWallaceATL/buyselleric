import { FeaturedListings } from "@/components/featured-listings";
import { HeroLoader } from "@/components/hero-loader";
import { LazySection } from "@/components/lazy-section";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Services = dynamic(() => import("@/components/services").then((m) => ({ default: m.Services })));
const About = dynamic(() => import("@/components/about").then((m) => ({ default: m.About })));
const SocialProof = dynamic(() => import("@/components/social-proof").then((m) => ({ default: m.SocialProof })));
const Faq = dynamic(() => import("@/components/faq").then((m) => ({ default: m.Faq })));

export const metadata: Metadata = createMetadata({
  title: `${siteConfig.name} · ${siteConfig.agentName}`,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage(): ReactNode {
  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      <HeroLoader />
      <FeaturedListings />
      {/* Eager mount: hash links (#services, #about) must exist on first paint for scroll + Lenis. */}
      <Services />
      <About />
      <SocialProof />
      <LazySection>
        <Faq />
      </LazySection>
    </main>
  );
}
