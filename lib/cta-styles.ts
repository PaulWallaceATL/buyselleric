/**
 * Large, high-contrast CTAs for readability and touch (≥52px height targets).
 */

const focus = "focus-ring outline-none";

export const ctaPrimary = `inline-flex min-h-[52px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-lg font-semibold text-background shadow-md transition-opacity hover:opacity-90 ${focus}`;

export const ctaSecondary = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-foreground/35 bg-transparent px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-foreground/5 ${focus}`;

export const ctaMortgage = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-ring bg-muted/50 px-8 py-4 text-lg font-semibold text-foreground shadow-sm transition-colors hover:border-ring hover:bg-muted/65 ${focus}`;

export const ctaFooterPrimary = `inline-flex min-h-[52px] items-center justify-center rounded-full bg-background px-10 py-5 text-lg font-semibold text-foreground shadow-lg transition-colors hover:bg-background/92 ${focus}`;

export const ctaFooterOutline = `inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-background/60 bg-transparent px-10 py-5 text-lg font-semibold text-background transition-colors hover:bg-background/12 ${focus}`;

/** Muted outline for secondary actions on light backgrounds */
export const ctaMutedOutline = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center rounded-full border-2 border-border bg-muted/30 px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-muted/50 ${focus}`;
