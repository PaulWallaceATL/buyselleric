"use client";

import { ListingsSpinner } from "@/components/listings-spinner";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

type ListingsNavContextValue = {
  startNavigation: TransitionStartFunction;
  /** Soft-nav to an href with the correct pending label (search vs single home). */
  navigateWithPending: (
    href: string,
    push: (href: string, opts?: { scroll?: boolean }) => void,
  ) => void;
};

const ListingsNavContext = createContext<ListingsNavContextValue | null>(null);

function pendingLabelForHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (/^\/listings\/mls\/[^/]+\/?$/.test(path)) return "Loading this home…";
  if (/^\/listings\/[^/]+\/?$/.test(path) && path !== "/listings" && !path.startsWith("/listings/mls")) {
    return "Loading this home…";
  }
  return "Loading homes…";
}

export function useListingsNav(): ListingsNavContextValue {
  const ctx = useContext(ListingsNavContext);
  if (!ctx) {
    return {
      startNavigation: (fn) => fn(),
      navigateWithPending: (href, push) => push(href, { scroll: false }),
    };
  }
  return ctx;
}

export function ListingsNavShell({ children }: { children: ReactNode }): ReactNode {
  const [isPending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("Loading homes…");
  const isDetailPending = pendingLabel === "Loading this home…";

  const navigateWithPending = useCallback(
    (href: string, push: (href: string, opts?: { scroll?: boolean }) => void) => {
      setPendingLabel(pendingLabelForHref(href));
      startTransition(() => {
        push(href, { scroll: false });
      });
    },
    [startTransition],
  );

  const value = useMemo(
    () => ({
      startNavigation: startTransition,
      navigateWithPending,
    }),
    [startTransition, navigateWithPending],
  );

  return (
    <ListingsNavContext.Provider value={value}>
      {isPending && !isDetailPending ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background px-8 py-6 shadow-xl">
            <ListingsSpinner />
            <p className="text-sm font-medium text-foreground">{pendingLabel}</p>
          </div>
        </div>
      ) : null}
      {isPending && isDetailPending ? (
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5 overflow-hidden bg-muted"
          aria-busy="true"
          aria-live="polite"
          aria-label={pendingLabel}
        >
          <div className="h-full w-1/3 animate-[pulse_0.9s_ease-in-out_infinite] bg-foreground/50" />
        </div>
      ) : null}
      {children}
    </ListingsNavContext.Provider>
  );
}

/** Wrap router.push / href navigation so the listings overlay appears during soft nav. */
export function useListingsNavigate() {
  const { navigateWithPending } = useListingsNav();
  return useCallback(
    (href: string, push: (href: string, opts?: { scroll?: boolean }) => void) => {
      navigateWithPending(href, push);
    },
    [navigateWithPending],
  );
}
