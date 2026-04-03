import { About } from "@/components/about";
import { Faq } from "@/components/faq";
import { FeaturedListings } from "@/components/featured-listings";
import { Hero } from "@/components/hero";
import { Services } from "@/components/services";
import { SocialProof } from "@/components/social-proof";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: `${siteConfig.name} · ${siteConfig.agentName}`,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage(): ReactNode {
  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      <Hero />
      <FeaturedListings />
      <Services />
      <About />
      <SocialProof />
      <Faq />
    </main>
  );
}
