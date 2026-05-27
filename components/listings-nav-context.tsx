"use client";

import { ListingsSpinner } from "@/components/listings-spinner";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

type ListingsNavContextValue = {
  startNavigation: TransitionStartFunction;
};

const ListingsNavContext = createContext<ListingsNavContextValue | null>(null);

export function useListingsNav(): ListingsNavContextValue {
  const ctx = useContext(ListingsNavContext);
  if (!ctx) {
    return { startNavigation: (fn) => fn() };
  }
  return ctx;
}

export function ListingsNavShell({ children }: { children: ReactNode }): ReactNode {
  const [isPending, startTransition] = useTransition();
  const value = useMemo(
    () => ({
      startNavigation: startTransition,
    }),
    [startTransition],
  );

  return (
    <ListingsNavContext.Provider value={value}>
      {isPending ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background px-8 py-6 shadow-xl">
            <ListingsSpinner />
            <p className="text-sm font-medium text-foreground">Loading homes…</p>
          </div>
        </div>
      ) : null}
      {children}
    </ListingsNavContext.Provider>
  );
}

/** Wrap router.push / href navigation so the listings overlay appears during soft nav. */
export function useListingsNavigate() {
  const { startNavigation } = useListingsNav();
  const navigate = useCallback(
    (href: string, push: (href: string, opts?: { scroll?: boolean }) => void) => {
      startNavigation(() => {
        push(href, { scroll: false });
      });
    },
    [startNavigation],
  );
  return navigate;
}
