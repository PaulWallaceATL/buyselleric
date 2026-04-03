"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ThemeSwitch(): ReactNode {
  const mounted = useIsMounted();
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-50">
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
    <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-50">
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
