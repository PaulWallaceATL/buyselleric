import { notFound } from "next/navigation";
import { ServiceDetailView } from "@/components/service-detail-view";
import { createMetadata } from "@/lib/metadata";
import { servicesData, servicesSlugs } from "@/lib/services-data";
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
  return <ServiceDetailView service={service} />;
}
