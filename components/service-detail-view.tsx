"use client";

import type { LucideIcon } from "lucide-react";
import {
  Handshake,
  Home,
  KeyRound,
  LineChart,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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

const serviceHeroIcon: Record<string, LucideIcon> = {
  "buyer-representation": Search,
  "seller-marketing": Megaphone,
  "pricing-negotiation": LineChart,
  "closing-coordination": KeyRound,
};

function iconFor(index: number): LucideIcon {
  return featureIcons[index % featureIcons.length] ?? Sparkles;
}

function ServiceIcon3D({
  Icon,
  size = "md",
}: {
  Icon: LucideIcon;
  size?: "md" | "lg" | "hero";
}) {
  const box =
    size === "hero"
      ? "h-48 w-48 sm:h-56 sm:w-56 md:h-64 md:w-64 lg:h-72 lg:w-72 xl:h-80 xl:w-80"
      : size === "lg"
        ? "h-40 w-40 sm:h-44 sm:w-44 md:h-48 md:w-48"
        : "h-[8.5rem] w-[8.5rem] sm:h-40 sm:w-40 md:h-44 md:w-44";
  const iconScale =
    size === "hero" ? "h-[44%] w-[44%]" : size === "lg" ? "h-[42%] w-[42%]" : "h-[42%] w-[42%]";
  const perspective = size === "hero" ? "[perspective:1200px]" : "[perspective:960px]";
  return (
    <div className={`mx-auto shrink-0 ${perspective}`} aria-hidden>
      <div
        className={`relative flex ${box} items-center justify-center rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-ring/30 via-muted/60 to-background shadow-[0_26px_60px_-22px_rgba(0,0,0,0.62)] transition-[transform,box-shadow] duration-500 ease-out will-change-transform [transform-style:preserve-3d] [transform:rotateX(10deg)_rotateY(-16deg)] hover:[transform:rotateX(5deg)_rotateY(-8deg)_translateZ(14px)] hover:shadow-[0_32px_70px_-24px_rgba(110,184,192,0.22)] sm:rounded-[2rem]`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-tr from-white/10 to-transparent" />
        <div className="pointer-events-none absolute inset-x-3 bottom-2 h-1/3 rounded-full bg-black/25 blur-2xl [transform:translateZ(-40px)_scale(1.1)]" />
        <Icon
          className={`relative z-[1] ${iconScale} text-ring drop-shadow-[0_8px_28px_rgba(110,184,192,0.38)]`}
          strokeWidth={1.35}
        />
      </div>
    </div>
  );
}

export function ServiceDetailView({ service }: { service: ServicePage }) {
  const [active, setActive] = useState(0);
  const feature = service.features[active];
  if (!feature) return null;
  const Icon = iconFor(active);
  const HeroIcon = serviceHeroIcon[service.slug] ?? Sparkles;

  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/25 via-background to-background pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-ring/10 blur-3xl"
        />
        <div className={`${siteContainer} relative max-w-4xl`}>
          <Link
            href="/#services-menu"
            className="inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← All services
          </Link>

          <div className="mt-10 flex flex-col items-center gap-12 sm:gap-14">
            <ServiceIcon3D Icon={HeroIcon} size="hero" />
            <div className="w-full text-center">
              <h1 className="mx-auto max-w-4xl text-balance font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                {service.headline}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {service.intro}
              </p>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground/90 sm:text-base">
                {service.description}
              </p>
              <div className="mt-10 flex flex-row flex-wrap justify-center gap-3">
                <Link href={service.ctaHref} className={ctaPrimary}>
                  {service.ctaText}
                </Link>
                <Link href="/#contact" className={ctaSecondary}>
                  Contact {siteConfig.agentName}
                </Link>
              </div>
            </div>
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
            Tap a focus area to explore how {siteConfig.agentName} supports Georgia buyers and sellers end-to-end.
            Same substance as before—presented in a clearer, more scannable layout.
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

          <div className="mt-12 flex flex-col items-center gap-10 sm:gap-12">
            <ServiceIcon3D Icon={Icon} size="lg" />
            <div className="w-full max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ring/90">
                {service.title} · {active + 1} / {service.features.length}
              </p>
              <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {feature.title}
              </h3>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {feature.description}
              </p>
              {feature.detail ? (
                <p className="mx-auto mt-6 max-w-2xl border-t border-ring/35 pt-6 text-base leading-relaxed text-muted-foreground/95">
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
