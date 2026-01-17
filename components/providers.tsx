"use client";

import { SmoothScroll } from "@/components/smooth-scroll";
import { ReducedMotionProvider } from "@/lib/motion";
import { OverlayProvider } from "@/lib/overlay-context";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ReducedMotionProvider>
        <OverlayProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </OverlayProvider>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
