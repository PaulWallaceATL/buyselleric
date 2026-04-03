import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ThemeSwitch } from "@/components/theme-switch";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <ThemeSwitch />
      {children}
      <Footer />
    </div>
  );
}
