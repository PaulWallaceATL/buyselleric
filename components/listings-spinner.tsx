import type { ReactNode } from "react";

export function ListingsSpinner({ className = "" }: { className?: string }): ReactNode {
  return (
    <div
      className={`h-9 w-9 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
