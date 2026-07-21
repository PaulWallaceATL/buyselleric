"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "site-banner-vidzee-v1";
const BANNER_HEIGHT = "44px";

/** Promo banner: turns listing photos into cinematic videos with Vidzee. Dismissible. */
export function SiteBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const dismissed =
      typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
    if (!dismissed) {
      setVisible(true);
      document.documentElement.style.setProperty("--site-banner-h", BANNER_HEIGHT);
    } else {
      document.documentElement.style.setProperty("--site-banner-h", "0px");
    }
    return () => {
      document.documentElement.style.setProperty("--site-banner-h", "0px");
    };
  }, []);

  function dismiss() {
    setVisible(false);
    document.documentElement.style.setProperty("--site-banner-h", "0px");
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-500 text-white shadow-[0_1px_0_rgba(0,0,0,0.15)]"
      style={{ height: BANNER_HEIGHT }}
      role="region"
      aria-label="Promotional banner"
    >
      <a
        href="https://www.vidzee.ai/?utm_source=buyselleric&utm_medium=banner&utm_campaign=launch"
        target="_blank"
        rel="noopener sponsored"
        className="group flex max-w-full items-center gap-2 px-4 text-xs font-medium sm:gap-3 sm:text-sm"
      >
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">
          <span aria-hidden className="text-base leading-none">✦</span>
          Vidzee
        </span>
        <span className="hidden truncate sm:inline">
          Turn your listing photos into cinematic videos in minutes — try Vidzee free
        </span>
        <span className="truncate sm:hidden">Listing photos → cinematic video — try Vidzee</span>
        <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 transition-transform group-hover:scale-105 sm:inline">
          Get started →
        </span>
      </a>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
