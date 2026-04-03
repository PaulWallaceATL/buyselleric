"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useOverlay } from "@/lib/overlay-context";
import { siteConfig } from "@/lib/config";

/** When the footer (#contact) rises into this band, hide the fixed bar on scroll-down to avoid overlap. */
const FOOTER_HIDE_TOP = 96;
const FOOTER_RELEASE_TOP = 160;

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
  const lastScrollY = useRef(0);
  const { isOverlayOpen } = useOverlay();

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
    if (!footer) {
      return;
    }

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
    if (hideOverFooter) {
      setIsMenuOpen(false);
    }
  }, [hideOverFooter]);

  return (
    <AnimatePresence>
      {!isOverlayOpen && (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={
            hideOverFooter
              ? { opacity: 0, y: -28, pointerEvents: "none" }
              : { opacity: 1, y: 0, pointerEvents: "auto" }
          }
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-50 px-6 pt-6 pb-8 sm:px-12 sm:pt-12 sm:pb-10 lg:px-24 lg:pb-12"
        >
          <div className="mx-auto flex max-w-360 items-center justify-between gap-4 2xl:max-w-450 3xl:max-w-550">
            <motion.a
              href="/"
              className="flex min-h-14 sm:min-h-[4.25rem] items-center justify-center rounded-xl sm:rounded-2xl bg-foreground/88 px-5 py-3 text-lg font-semibold tracking-tight text-background shadow-lg shadow-foreground/10 backdrop-blur-lg sm:px-7 sm:text-2xl shrink-0"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {siteConfig.brandSlug}
            </motion.a>

            <div className="relative min-h-14 sm:min-h-[4.25rem]">
              <motion.div
                className="absolute top-0 right-0 w-52 sm:w-64 bg-foreground/88 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-lg shadow-foreground/10 overflow-hidden"
                initial={{ opacity: 0, y: -20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  height: isMenuOpen ? "auto" : isMobile ? 56 : 68,
                }}
                transition={{
                  duration: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                  height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2 text-background sm:min-h-[4.25rem] sm:px-5"
                >
                  <span className="text-lg font-semibold sm:text-xl">{activeSection}</span>
                  <motion.div
                    className="relative h-6 w-6 sm:h-7 sm:w-7"
                    animate={{ rotate: isMenuOpen ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="absolute left-1/2 top-0 h-6 sm:h-7 w-[2px] -translate-x-1/2 bg-current" />
                    <span className="absolute left-0 top-1/2 h-[2px] w-6 sm:w-7 -translate-y-1/2 bg-current" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.nav
                      className="px-4 pb-5 sm:px-5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
                      <ul className="flex flex-col gap-0.5">
                        {menuItems.map((item, index) => (
                          <motion.li
                            key={item.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{
                              duration: 0.3,
                              delay: 0.05 * index,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
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
                          </motion.li>
                        ))}
                      </ul>
                    </motion.nav>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
