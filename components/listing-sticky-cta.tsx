"use client";

import { siteConfig } from "@/lib/config";

type ListingStickyCtaProps = {
  inquiryHref?: string;
};

/**
 * Mobile-only thumb-zone actions for listing detail. Desktop uses the sidebar /
 * inquiry block instead.
 */
export function ListingStickyCta({ inquiryHref = "#inquiry" }: ListingStickyCtaProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden"
      role="region"
      aria-label="Contact actions"
    >
      <div className="mx-auto flex max-w-lg gap-2">
        <a
          href={`tel:${siteConfig.phoneTel}`}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border-2 border-foreground/30 bg-background px-3 text-sm font-semibold text-foreground touch-manipulation focus-ring outline-none"
        >
          Call
        </a>
        <a
          href={`sms:${siteConfig.phoneTel}`}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border-2 border-foreground/30 bg-background px-3 text-sm font-semibold text-foreground touch-manipulation focus-ring outline-none"
        >
          Text
        </a>
        <a
          href={inquiryHref}
          className="inline-flex min-h-[48px] flex-[1.35] items-center justify-center rounded-full bg-foreground px-3 text-sm font-semibold text-background touch-manipulation focus-ring outline-none"
        >
          Request showing
        </a>
      </div>
    </div>
  );
}
