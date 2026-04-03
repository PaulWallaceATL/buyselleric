import { SellHouseForm } from "@/components/sell-house-form";
import { siteConfig } from "@/lib/config";
import { createMetadata } from "@/lib/metadata";
import { lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "Sell your home",
  description: `Request a consultation with ${siteConfig.agentName}. Get pricing insight, prep guidance, and a marketing plan that fits your timeline.`,
  path: "/sell",
});

export default function SellPage(): ReactNode {
  return (
    <main id="main-content" className={pageMain}>
      <div className={siteContainer}>
        <h1 className={sectionTitle}>
          Sell with {siteConfig.agentName}
        </h1>
        <p className={`${lead} mt-4`}>
          Share a few details about your property and goals. You will get a thoughtful follow-up—no
          pressure, no spam—just a clear next step.
        </p>
        <div className="mt-10 sm:mt-12">
          <SellHouseForm />
        </div>
      </div>
    </main>
  );
}
