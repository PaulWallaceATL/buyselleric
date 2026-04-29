"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { ctaFooterOutline, ctaFooterPrimary } from "@/lib/cta-styles";
import { siteContainer } from "@/lib/ui";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Listings", href: "/listings" },
  { label: "Sell", href: "/sell" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "#contact" },
];

const footerLinks = [
  { label: "About Eric", href: "/#about" },
  { label: "Homes for sale", href: "/listings" },
  { label: "List your home", href: "/sell" },
];

const footerServiceLinks = [
  { label: "Buyer tours & offers", href: "/services/buyer-representation" },
  { label: "Listing prep & marketing", href: "/services/seller-marketing" },
  { label: "Pricing strategy", href: "/services/pricing-negotiation" },
  { label: "Contract to close", href: "/services/closing-coordination" },
];

export function Footer() {
  const mail = `mailto:${siteConfig.email}?subject=${encodeURIComponent("Real estate inquiry")}`;

  const colHeading = "text-base font-semibold text-background/70";
  const listRow = "text-base text-background leading-snug";

  return (
    <footer
      id="contact"
      className="scroll-mt-6 bg-foreground text-background sm:scroll-mt-8 lg:scroll-mt-10"
    >
      <div className={`${siteContainer} pb-14 pt-28 text-center sm:pb-16 sm:pt-32 sm:text-left lg:pb-20 lg:pt-36`}>
        <a
          href={mail}
          className="block text-2xl font-medium tracking-tight hover:opacity-80 transition-opacity break-all sm:break-normal sm:text-5xl lg:text-7xl"
        >
          {siteConfig.email}
        </a>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-start">
          <Link href={mail} className={ctaFooterPrimary}>
            Email Eric
          </Link>
          <a href={`tel:${siteConfig.phoneTel}`} className={ctaFooterOutline}>
            Call {siteConfig.phoneDisplay}
          </a>
        </div>
      </div>

      <div className={siteContainer}>
        <div className="border-t border-background/10" />
      </div>

      <div className={`${siteContainer} py-12 lg:py-16`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:gap-y-10">
          <div className="lg:col-span-4">
            <h4 className={`${colHeading} mb-6`}>{siteConfig.name}</h4>
            <p className="text-4xl font-medium tracking-tight text-background">{siteConfig.brandSlug}</p>
            <p className="mt-4 text-2xl font-medium tracking-tight text-background/60 sm:text-3xl lg:text-4xl">
              {siteConfig.tagline}
            </p>
            <ul className="mt-4 list-none space-y-1.5 text-base text-background/55">
              {siteConfig.footerCredentialLines.map((line) => (
                <li key={line} className="flex gap-2 leading-snug">
                  <span className="shrink-0 text-background/35" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 lg:col-span-8 lg:gap-10">
            <div>
              <h4 className={`${colHeading} mb-6`}>Areas served</h4>
              <p className={`${listRow} font-medium`}>{siteConfig.primaryMarket}</p>
              <p className={`${listRow} mt-2 text-background/60`}>Neighborhood tours by appointment</p>
            </div>

            <div>
              <h4 className={`${colHeading} mb-6`}>Services</h4>
              <ul className="space-y-3">
                {footerServiceLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`${listRow} inline-flex py-0.5 underline-offset-4 hover:underline hover:text-background/90`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className={`${colHeading} mb-6`}>Navigation</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={`${listRow} inline-flex py-0.5 hover:text-background/80`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={`${siteContainer} border-t border-background/10 py-8`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:justify-start">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="min-h-11 inline-flex items-center text-base text-background/70 hover:text-background transition-colors py-1"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-base text-background/45">
            © {new Date().getFullYear()} {siteConfig.name} · {siteConfig.agentName}
          </p>
        </div>
      </div>
    </footer>
  );
}
