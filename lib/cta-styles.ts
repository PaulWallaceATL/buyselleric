/**
 * Large, high-contrast CTAs for readability and touch (≥52px height targets).
 */

const focus = "focus-ring outline-none";
const touch = "touch-manipulation select-none";

export const ctaPrimary = `inline-flex min-h-[52px] w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-7 py-4 text-base font-semibold text-background shadow-md transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] sm:px-8 sm:text-lg ${touch} ${focus}`;

export const ctaSecondary = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-foreground/35 bg-transparent px-7 py-4 text-base font-semibold text-foreground transition-colors hover:bg-foreground/5 active:scale-[0.98] sm:px-8 sm:text-lg ${touch} ${focus}`;

export const ctaMortgage = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-ring bg-muted/50 px-7 py-4 text-base font-semibold text-foreground shadow-sm transition-colors hover:border-ring hover:bg-muted/65 active:scale-[0.98] sm:px-8 sm:text-lg ${touch} ${focus}`;

export const ctaFooterPrimary = `inline-flex min-h-[52px] items-center justify-center rounded-full bg-background px-8 py-5 text-base font-semibold text-foreground shadow-lg transition-colors hover:bg-background/92 active:scale-[0.98] sm:px-10 sm:text-lg ${touch} ${focus}`;

export const ctaFooterOutline = `inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-background/60 bg-transparent px-8 py-5 text-base font-semibold text-background transition-colors hover:bg-background/12 active:scale-[0.98] sm:px-10 sm:text-lg ${touch} ${focus}`;

/** Muted outline for secondary actions on light backgrounds */
export const ctaMutedOutline = `inline-flex min-h-[52px] w-full sm:w-auto items-center justify-center rounded-full border-2 border-border bg-muted/30 px-7 py-4 text-base font-semibold text-foreground transition-colors hover:bg-muted/50 active:scale-[0.98] sm:px-8 sm:text-lg ${touch} ${focus}`;
