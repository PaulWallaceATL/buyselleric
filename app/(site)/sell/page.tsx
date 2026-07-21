import Image from "next/image";
import Link from "next/link";
import { SellHero } from "@/components/sell-hero";
import { SellHouseForm } from "@/components/sell-house-form";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import { siteImages } from "@/lib/site-images";
import { listingHeroTopPadding, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "Sell your home",
  description: `Request a consultation with ${siteConfig.agentName}. Get pricing insight, prep guidance, and a marketing plan that fits your timeline.`,
  path: "/sell",
});

const nextSteps = [
  {
    n: "01",
    title: "Share a few details",
    body: "Address, timeline, and what’s unique about your home.",
  },
  {
    n: "02",
    title: "Get a clear next step",
    body: "Eric follows up with pricing context and a realistic plan.",
  },
  {
    n: "03",
    title: "Move when you’re ready",
    body: "Prep, marketing, and negotiation, paced to your goals.",
  },
] as const;

export default function SellPage(): ReactNode {
  return (
    <main
      id="main-content"
      className="relative z-10 w-full flex-1 bg-background pb-24 sm:pb-28"
      style={listingHeroTopPadding}
    >
      <SellHero />

      <section id="consultation" className={`${siteContainer} scroll-mt-28 pt-8 sm:pt-10 lg:pt-12`}>
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12 xl:gap-14">
          <aside className="lg:col-span-5 lg:sticky lg:top-28">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Simple path from{" "}
              <em className="font-serif font-normal italic">curious</em> to closing
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              No spam. No pressure. Just a thoughtful conversation about what selling well
              looks like for you.
            </p>

            <ol className="mt-10 space-y-7">
              {nextSteps.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 font-serif text-2xl tabular-nums text-muted-foreground/70"
                  >
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold tracking-tight text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex items-center gap-4 border-t border-border/70 pt-8">
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
                <Image
                  src={siteImages.ericHeadshot}
                  alt={siteConfig.agentName}
                  fill
                  sizes="56px"
                  className="object-cover object-top"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{siteConfig.agentName}</p>
                <Link
                  href={`tel:${siteConfig.phoneTel}`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  {siteConfig.phoneDisplay}
                </Link>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-7">
            <SellHouseForm />
          </div>
        </div>
      </section>
    </main>
  );
}
