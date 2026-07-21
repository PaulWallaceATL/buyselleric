"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useOverlay } from "@/lib/overlay-context";
import { siteConfig } from "@/lib/config";

const FOOTER_HIDE_TOP = 96;
const FOOTER_RELEASE_TOP = 160;
/** Past this offset from top, scroll-down hides the bar; scroll-up shows it. */
const SCROLL_SHOW_TOP_THRESHOLD = 48;
const SCROLL_DIRECTION_DELTA = 8;

const sections = [
  { id: "hero", label: "Home" },
  { id: "featured-listings", label: "Search" },
  { id: "services", label: "Services" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/listings" },
  { label: "Sell", href: "/sell" },
  { label: "Blog", href: "/blog" },
  { label: "Services", href: "/#services-menu" },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("Home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hideOverFooter, setHideOverFooter] = useState(false);
  const [hiddenByScrollDir, setHiddenByScrollDir] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDirPrevY = useRef(0);
  const { isOverlayOpen } = useOverlay();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      const isNearBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 100;
      if (isNearBottom) {
        setActiveSection("Contact");
        return;
      }

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (!section) continue;
        if (section.id === "contact") continue;
        const element =
          document.querySelector(`.${section.id}`) || document.getElementById(section.id);
        if (element) {
          const { offsetTop } = element as HTMLElement;
          if (scrollPosition >= offsetTop) {
            setActiveSection(section.label);
            return;
          }
        }
      }
      if (sections[0]) {
        const path = window.location.pathname;
        if (path === "/listings" || path.startsWith("/listings/")) {
          setActiveSection("Search");
        } else {
          setActiveSection(sections[0].label);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** Homepage scroll owns “Home” vs “Search”; other routes set the pill from the path. */
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/listings")) {
      setActiveSection("Search");
      return;
    }
    if (pathname === "/sell") {
      setActiveSection("Sell");
      return;
    }
    if (pathname.startsWith("/blog")) {
      setActiveSection("Blog");
      return;
    }
    if (pathname.startsWith("/services/")) {
      setActiveSection("Services");
      return;
    }
    if (pathname === "/") {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("scroll"));
      });
    }
  }, [pathname]);

  useEffect(() => {
    const footer = document.getElementById("contact");
    if (!footer) return;

    const syncFooterOverlap = () => {
      const rect = footer.getBoundingClientRect();
      const y = window.scrollY;
      const scrollingUp = y < lastScrollY.current - 2;
      lastScrollY.current = y;

      const footerVisible = rect.bottom > 48;
      const inOverlapBand = footerVisible && rect.top < FOOTER_HIDE_TOP;
      const clearedBand = !footerVisible || rect.top > FOOTER_RELEASE_TOP;

      if (scrollingUp) {
        setHideOverFooter(false);
        return;
      }
      if (inOverlapBand) {
        setHideOverFooter(true);
        return;
      }
      if (clearedBand) {
        setHideOverFooter(false);
      }
    };

    window.addEventListener("scroll", syncFooterOverlap, { passive: true });
    window.addEventListener("resize", syncFooterOverlap, { passive: true });
    lastScrollY.current = window.scrollY;
    syncFooterOverlap();
    return () => {
      window.removeEventListener("scroll", syncFooterOverlap);
      window.removeEventListener("resize", syncFooterOverlap);
    };
  }, []);

  useEffect(() => {
    if (hideOverFooter) setIsMenuOpen(false);
  }, [hideOverFooter]);

  useEffect(() => {
    scrollDirPrevY.current = window.scrollY;

    const onScrollDir = () => {
      const y = window.scrollY;
      if (y <= SCROLL_SHOW_TOP_THRESHOLD) {
        setHiddenByScrollDir(false);
        scrollDirPrevY.current = y;
        return;
      }
      const dy = y - scrollDirPrevY.current;
      scrollDirPrevY.current = y;
      if (dy > SCROLL_DIRECTION_DELTA) {
        setHiddenByScrollDir(true);
      } else if (dy < -SCROLL_DIRECTION_DELTA) {
        setHiddenByScrollDir(false);
      }
    };

    window.addEventListener("scroll", onScrollDir, { passive: true });
    onScrollDir();
    return () => window.removeEventListener("scroll", onScrollDir);
  }, []);

  if (isOverlayOpen) return null;

  const headerHidden = hideOverFooter || (hiddenByScrollDir && !isMenuOpen);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pb-5 sm:px-12 sm:pt-12 sm:pb-10 lg:px-24 lg:pb-12"
      style={{
        opacity: mounted ? (headerHidden ? 0 : 1) : 0,
        transform: `translateY(${mounted ? (headerHidden ? "-28px" : "0") : "-20px"})`,
        pointerEvents: headerHidden ? "none" : "auto",
        transition: "opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div className="mx-auto flex max-w-360 items-center justify-between gap-3 sm:gap-4 2xl:max-w-450 3xl:max-w-550">
        <a
          href="/"
          className="flex min-h-11 min-w-0 max-w-[calc(100%-3.5rem)] shrink items-center justify-center truncate rounded-xl bg-foreground/88 px-3.5 py-2.5 text-base font-semibold tracking-tight text-background shadow-lg shadow-foreground/10 backdrop-blur-lg transition-transform duration-150 hover:scale-105 active:scale-95 sm:max-w-none sm:min-h-[4.25rem] sm:rounded-2xl sm:px-7 sm:py-3 sm:text-2xl"
        >
          {siteConfig.brandSlug}
        </a>

        {/* Mobile: icon-only hamburger — no section label, no overlap with logo */}
        <div className="relative shrink-0 sm:hidden">
          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/88 text-background shadow-lg shadow-foreground/10 backdrop-blur-lg transition-transform duration-150 active:scale-95"
          >
            {isMenuOpen ? <X className="h-5 w-5" strokeWidth={2.25} aria-hidden /> : <Menu className="h-5 w-5" strokeWidth={2.25} aria-hidden />}
          </button>

          {isMenuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px]"
                onClick={() => setIsMenuOpen(false)}
              />
              <nav
                id="mobile-nav-menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),16rem)] overflow-hidden rounded-xl bg-foreground/95 shadow-xl shadow-foreground/15 backdrop-blur-lg animate-[fadeIn_0.2s_ease]"
              >
                <ul className="flex flex-col p-2">
                  {menuItems.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActiveSection(item.label);
                        }}
                        className={`block min-h-11 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
                          activeSection === item.label
                            ? "bg-background/15 text-background"
                            : "text-background/70 hover:bg-background/10 hover:text-background"
                        }`}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </>
          ) : null}
        </div>

        {/* Desktop: expandable section pill */}
        <div className="relative hidden min-h-[4.25rem] sm:block">
          <div
            className="absolute top-0 right-0 w-64 overflow-hidden rounded-2xl bg-foreground/88 shadow-lg shadow-foreground/10 backdrop-blur-lg"
            style={{
              height: isMenuOpen ? "auto" : "68px",
              transition: "height 0.4s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="desktop-nav-menu"
              aria-haspopup="true"
              aria-label={isMenuOpen ? "Close menu" : `Open menu, current section ${activeSection}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex min-h-[4.25rem] w-full items-center justify-between gap-4 px-5 py-2 text-background"
            >
              <span className="text-xl font-semibold" aria-hidden>
                {activeSection}
              </span>
              <div
                className="relative h-7 w-7"
                aria-hidden
                style={{
                  transform: `rotate(${isMenuOpen ? 45 : 0}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <span className="absolute left-1/2 top-0 h-7 w-[2px] -translate-x-1/2 bg-current" />
                <span className="absolute left-0 top-1/2 h-[2px] w-7 -translate-y-1/2 bg-current" />
              </div>
            </button>

            {isMenuOpen ? (
              <nav id="desktop-nav-menu" className="animate-[fadeIn_0.2s_ease] px-5 pb-5">
                <ul className="flex flex-col gap-0.5">
                  {menuItems.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        onClick={() => {
                          setIsMenuOpen(false);
                          setActiveSection(item.label);
                        }}
                        className={`block min-h-12 py-3 text-xl font-semibold transition-colors hover:text-background ${
                          activeSection === item.label
                            ? "text-background underline underline-offset-4"
                            : "text-background/65"
                        }`}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
