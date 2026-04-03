"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { ctaFooterOutline, ctaFooterPrimary } from "@/lib/cta-styles";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Listings", href: "/listings" },
  { label: "Sell", href: "/sell" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "#contact" },
];

const footerLinks = [
  { label: "About Eric", href: "/#about" },
  { label: "Homes for sale", href: "/listings" },
  { label: "List your home", href: "/sell" },
];

export function Footer() {
  const mail = `mailto:${siteConfig.email}?subject=${encodeURIComponent("Real estate inquiry")}`;

  return (
    <footer id="contact" className="lg:sticky lg:bottom-0 lg:z-0 bg-foreground text-background">
      <div className="px-6 sm:px-12 lg:px-24 pt-24 lg:pt-32 pb-16 lg:pb-24 text-center sm:text-left max-w-360 2xl:max-w-450 3xl:max-w-550 mx-auto">
        <a
          href={mail}
          className="text-2xl sm:text-5xl lg:text-7xl font-medium tracking-tight hover:opacity-80 transition-opacity break-all sm:break-normal"
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

      <div className="px-6 sm:px-12 lg:px-24 max-w-360 2xl:max-w-450 3xl:max-w-550 mx-auto">
        <div className="border-t border-background/10" />
      </div>

      <div className="px-6 sm:px-12 lg:px-24 py-16 lg:py-24 max-w-360 2xl:max-w-450 3xl:max-w-550 mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-8">
          <div>
            <span className="text-4xl font-medium tracking-tight">{siteConfig.brandSlug}</span>
            <p className="mt-4 text-background/60 text-2xl sm:text-4xl">{siteConfig.tagline}</p>
            <p className="mt-4 text-base text-background/55">
              {siteConfig.agentName} · {siteConfig.license}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-16 lg:gap-24">
            <div>
              <h4 className="text-base font-semibold text-background/70 mb-6">Areas served</h4>
              <div className="mb-6">
                <p className="font-medium mb-1">{siteConfig.primaryMarket}</p>
                <p className="text-background/60 text-base">Neighborhood tours by appointment</p>
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold text-background/70 mb-6">Services</h4>
              <ul className="space-y-3 text-base">
                <li>
                  <span className="text-background">Buyer tours & offers</span>
                </li>
                <li>
                  <span className="text-background">Listing prep & marketing</span>
                </li>
                <li>
                  <span className="text-background">Pricing strategy</span>
                </li>
                <li>
                  <span className="text-background">Contract to close</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-base font-semibold text-background/70 mb-6">Navigation</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center text-lg text-background hover:text-background/75 transition-colors py-1"
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

      <div className="px-6 sm:px-12 lg:px-24 py-6 max-w-360 2xl:max-w-450 3xl:max-w-550 mx-auto">
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
