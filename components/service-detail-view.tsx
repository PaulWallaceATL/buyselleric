"use client";

import type { LucideIcon } from "lucide-react";
import { Handshake, Home, KeyRound, LineChart, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/lib/config";
import { ctaPrimary, ctaSecondary } from "@/lib/cta-styles";
import type { ServicePage } from "@/lib/services-data";
import { siteContainer } from "@/lib/ui";

const featureIcons: LucideIcon[] = [
  Search,
  Home,
  LineChart,
  Handshake,
  ShieldCheck,
  KeyRound,
  Sparkles,
];

function iconFor(index: number): LucideIcon {
  return featureIcons[index % featureIcons.length] ?? Sparkles;
}

export function ServiceDetailView({ service }: { service: ServicePage }) {
  const [active, setActive] = useState(0);
  const feature = service.features[active];
  if (!feature) return null;
  const Icon = iconFor(active);

  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/25 via-background to-background pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-ring/10 blur-3xl"
        />
        <div className={`${siteContainer} relative max-w-4xl`}>
          <Link
            href="/#services"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← All services
          </Link>
          <h1 className="mt-6 text-balance font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
            {service.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {service.intro}
          </p>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground/90 sm:text-base">
            {service.description}
          </p>
          <div className="mt-10 flex flex-row flex-wrap gap-3">
            <Link href={service.ctaHref} className={ctaPrimary}>
              {service.ctaText}
            </Link>
            <Link href="/#contact" className={ctaSecondary}>
              Contact {siteConfig.agentName}
            </Link>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20 lg:py-28">
        <div className={`${siteContainer} max-w-6xl`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ring">What you get</p>
          <h2 className="mt-3 max-w-3xl font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Every pillar of this service—organized like your transaction actually runs.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Tap a focus area to explore how {siteConfig.agentName} supports Georgia buyers and sellers
            end-to-end. Same substance as before—presented in a clearer, more scannable layout.
          </p>

          <div className="mt-10 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {service.features.map((f, i) => {
              const TabIcon = iconFor(i);
              const isActive = i === active;
              return (
                <button
                  key={f.title}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`flex min-w-[11.5rem] max-w-[14rem] shrink-0 flex-col rounded-2xl border px-4 py-4 text-left transition-all sm:min-w-0 sm:max-w-none sm:flex-1 sm:px-5 ${
                    isActive
                      ? "border-ring bg-muted/40 shadow-lg shadow-ring/10 ring-2 ring-ring/25"
                      : "border-border/70 bg-muted/10 hover:border-border hover:bg-muted/25"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                      isActive ? "border-ring/50 bg-background text-ring" : "border-border/80 text-muted-foreground"
                    }`}
                  >
                    <TabIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="mt-3 text-sm font-semibold leading-snug text-foreground">{f.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-12 grid items-stretch gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-ring/15 via-muted/30 to-background p-10 lg:min-h-[360px]">
              <div
                aria-hidden
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-ring/10 blur-2xl"
              />
              <Icon className="relative z-[1] h-28 w-28 text-ring/35 sm:h-36 sm:w-36" strokeWidth={1} />
              <p className="relative z-[1] mt-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {service.title} · Step {active + 1} of {service.features.length}
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {feature.title}
              </h3>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{feature.description}</p>
              {feature.detail ? (
                <p className="mt-5 border-l-2 border-ring/50 pl-5 text-base leading-relaxed text-muted-foreground/95">
                  {feature.detail}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/15 py-16 sm:py-20 lg:py-24">
        <div className={`${siteContainer} max-w-3xl`}>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Common questions
          </h2>
          <div className="mt-10 flex flex-col gap-4">
            {service.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-border/80 bg-background/80 p-6 shadow-sm open:shadow-md sm:rounded-3xl"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-foreground sm:text-lg [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {faq.question}
                    <span className="mt-1 shrink-0 text-ring transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className={`${siteContainer} max-w-3xl text-center`}>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Reach out to {siteConfig.agentName} for a no-obligation conversation about your real estate goals.
          </p>
          <div className="mt-8 flex flex-row flex-wrap justify-center gap-3">
            <Link href={service.ctaHref} className={ctaPrimary}>
              {service.ctaText}
            </Link>
            <a href={`mailto:${siteConfig.email}`} className={ctaSecondary}>
              Email {siteConfig.agentName}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
