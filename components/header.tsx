"use client";

import { useEffect, useRef, useState } from "react";
import { useOverlay } from "@/lib/overlay-context";
import { siteConfig } from "@/lib/config";

const FOOTER_HIDE_TOP = 96;
const FOOTER_RELEASE_TOP = 160;
/** Past this offset from top, scroll-down hides the bar; scroll-up shows it. */
const SCROLL_SHOW_TOP_THRESHOLD = 48;
const SCROLL_DIRECTION_DELTA = 8;

const sections = [
  { id: "hero", label: "Home" },
  { id: "featured-listings", label: "Homes" },
  { id: "services", label: "Services" },
  { id: "about", label: "About" },
  { id: "social-proof", label: "Stories" },
  { id: "contact", label: "Contact" },
];

const menuItems = [
  { label: "Home", href: "#" },
  { label: "Homes", href: "#featured-listings" },
  { label: "Listings", href: "/listings" },
  { label: "Sell", href: "/sell" },
  { label: "Blog", href: "/blog" },
  { label: "Services", href: "#services-menu" },
  { label: "About", href: "#about" },
  { label: "Stories", href: "#social-proof" },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  const [activeSection, setActiveSection] = useState("Home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hideOverFooter, setHideOverFooter] = useState(false);
  const [hiddenByScrollDir, setHiddenByScrollDir] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDirPrevY = useRef(0);
  const { isOverlayOpen } = useOverlay();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
        setActiveSection(sections[0].label);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const menuHeight = isMenuOpen ? "auto" : isMobile ? "56px" : "68px";
  const headerHidden = hideOverFooter || (hiddenByScrollDir && !isMenuOpen);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-6 pt-6 pb-8 sm:px-12 sm:pt-12 sm:pb-10 lg:px-24 lg:pb-12"
      style={{
        opacity: mounted ? (headerHidden ? 0 : 1) : 0,
        transform: `translateY(${mounted ? (headerHidden ? "-28px" : "0") : "-20px"})`,
        pointerEvents: headerHidden ? "none" : "auto",
        transition: "opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div className="mx-auto flex max-w-360 items-center justify-between gap-4 2xl:max-w-450 3xl:max-w-550">
        <a
          href="/"
          className="flex min-h-14 sm:min-h-[4.25rem] items-center justify-center rounded-xl sm:rounded-2xl bg-foreground/88 px-5 py-3 text-lg font-semibold tracking-tight text-background shadow-lg shadow-foreground/10 backdrop-blur-lg sm:px-7 sm:text-2xl shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          {siteConfig.brandSlug}
        </a>

        <div className="relative min-h-14 sm:min-h-[4.25rem]">
          <div
            className="absolute top-0 right-0 w-52 sm:w-64 bg-foreground/88 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-lg shadow-foreground/10 overflow-hidden"
            style={{
              height: menuHeight,
              transition: "height 0.4s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2 text-background sm:min-h-[4.25rem] sm:px-5"
            >
              <span className="text-lg font-semibold sm:text-xl">{activeSection}</span>
              <div
                className="relative h-6 w-6 sm:h-7 sm:w-7"
                style={{
                  transform: `rotate(${isMenuOpen ? 45 : 0}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <span className="absolute left-1/2 top-0 h-6 sm:h-7 w-[2px] -translate-x-1/2 bg-current" />
                <span className="absolute left-0 top-1/2 h-[2px] w-6 sm:w-7 -translate-y-1/2 bg-current" />
              </div>
            </button>

            {isMenuOpen && (
              <nav className="px-4 pb-5 sm:px-5 animate-[fadeIn_0.2s_ease]">
                <ul className="flex flex-col gap-0.5">
                  {menuItems.map((item) => (
                    <li key={item.label}>
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
