import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SiteBanner } from "@/components/site-banner";
import { ThemeSwitch } from "@/components/theme-switch";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ paddingTop: "var(--site-banner-h, 0px)" }}
    >
      <SiteBanner />
      <Header />
      <ThemeSwitch />
      {children}
      <Footer />
    </div>
  );
}
