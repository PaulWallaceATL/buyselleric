import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { ctaPrimary, ctaSecondary } from "@/lib/cta-styles";
import { createMetadata } from "@/lib/metadata";
import { servicesData, servicesSlugs } from "@/lib/services-data";
import { siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = Readonly<{ params: Promise<{ slug: string }> }>;

export function generateStaticParams() {
  return servicesSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = servicesData[slug];
  if (!service) return {};
  return createMetadata({
    title: service.title,
    description: service.description,
    path: `/services/${slug}`,
  });
}

export default async function ServicePage({ params }: Props): Promise<ReactNode> {
  const { slug } = await params;
  const service = servicesData[slug];
  if (!service) notFound();

  return (
    <main id="main-content" className="relative z-10 w-full flex-1 bg-background">
      <section className="bg-background pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pt-36">
        <div className={`${siteContainer} max-w-4xl`}>
          <Link
            href="/#services-menu"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← All services
          </Link>
          <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {service.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {service.intro}
          </p>
          <div className="mt-8 flex flex-row flex-wrap gap-3">
            <Link href={service.ctaHref} className={ctaPrimary}>
              {service.ctaText}
            </Link>
            <Link href="/#contact" className={ctaSecondary}>
              Contact {siteConfig.agentName}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-16 sm:py-20 lg:py-24">
        <div className={`${siteContainer} max-w-4xl`}>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            What you get
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {service.features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border/80 bg-background p-6 shadow-sm sm:rounded-3xl"
              >
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className={`${siteContainer} max-w-3xl`}>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Common questions
          </h2>
          <div className="mt-10 flex flex-col gap-4">
            {service.faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-border/80 bg-muted/10 p-6 sm:rounded-3xl"
              >
                <h3 className="text-base font-semibold text-foreground sm:text-lg">
                  {faq.question}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-16 sm:py-20 lg:py-24">
        <div className={`${siteContainer} max-w-3xl text-center`}>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Reach out to {siteConfig.agentName} for a no-obligation conversation about your
            real estate goals.
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
