/**
 * Shared layout and typography tokens for marketing pages (responsive, consistent rhythm).
 */

export const siteContainer =
  "mx-auto w-full max-w-360 px-6 sm:px-12 lg:px-24 2xl:max-w-450 3xl:max-w-550";

/** Vertical padding for major sections */
export const sectionY = "py-16 sm:py-20 md:py-24 lg:py-28";

/** Small caps label above headings */
export const eyebrow =
  "text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm";

/** Standard section H2 */
export const sectionTitle =
  "text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl";

/** Inner pages (<main>) — below fixed header, full-width column */
export const pageMain =
  "relative z-10 w-full flex-1 bg-background px-6 pb-24 pt-24 sm:px-12 sm:pb-28 sm:pt-28 lg:px-24 lg:pt-32";

/** Muted body under titles */
export const lead =
  "max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg";

/** Card surface on light background */
export const cardSurface =
  "rounded-2xl border border-border/80 bg-muted/25 shadow-sm sm:rounded-3xl";
