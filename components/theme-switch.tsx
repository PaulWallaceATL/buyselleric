"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function isListingDetailPath(pathname: string): boolean {
  return (
    /^\/listings\/mls\/[^/]+$/.test(pathname) ||
    (/^\/listings\/[^/]+$/.test(pathname) && pathname !== "/listings")
  );
}

export function ThemeSwitch(): ReactNode {
  const mounted = useIsMounted();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Sit above the mobile sticky CTA on listing detail pages.
  const liftForStickyCta = isListingDetailPath(pathname);
  const positionClass = liftForStickyCta
    ? "fixed bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.25rem))] right-[max(1.25rem,env(safe-area-inset-right))] z-50 lg:bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
    : "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-50";

  if (!mounted) {
    return (
      <div className={positionClass}>
        <button
          className="h-14 w-14 cursor-not-allowed rounded-full bg-foreground/10 opacity-30"
          aria-label="Toggle theme"
          disabled
        />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className={positionClass}>
      <button
        onClick={toggleTheme}
        className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-border bg-muted/90 text-foreground shadow-lg transition-[opacity,transform] duration-300 hover:scale-105 hover:opacity-100 hover:shadow-xl active:scale-95 sm:h-[3.75rem] sm:w-[3.75rem]"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-pressed={isDark}
        type="button"
      >
        {isDark ? (
          <Sun className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Moon className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
