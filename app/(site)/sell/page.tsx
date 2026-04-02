import { SellHouseForm } from "@/components/sell-house-form";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "Sell your home",
  description: `Request a consultation with ${siteConfig.agentName}. Get pricing insight, prep guidance, and a marketing plan that fits your timeline.`,
  path: "/sell",
});

export default function SellPage(): ReactNode {
  return (
    <main id="main-content" className="min-h-screen bg-background px-6 pb-24 pt-28 sm:px-12 lg:px-24">
      <div className="mx-auto max-w-360 2xl:max-w-450 3xl:max-w-550">
        <h1 className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Sell with {siteConfig.agentName}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Share a few details about your property and goals. You will get a thoughtful follow-up—no
          pressure, no spam—just a clear next step.
        </p>
        <div className="mt-12">
          <SellHouseForm />
        </div>
      </div>
    </main>
  );
}
