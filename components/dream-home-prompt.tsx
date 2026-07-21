"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type DreamHomePromptProps = {
  /** Visual density for hero vs listings page. */
  variant?: "hero" | "listings";
  /** Prefill when returning from a prior dream search. */
  defaultValue?: string;
  /** Called after a successful navigate (optional). */
  onSuccess?: () => void;
};

export function DreamHomePrompt({
  variant = "listings",
  defaultValue = "",
  onSuccess,
}: DreamHomePromptProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt(defaultValue);
  }, [defaultValue]);

  const submit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = prompt.trim();
      if (trimmed.length < 8) {
        setError("Add a bit more detail — city, budget, or bedrooms help.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/listings/dream-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          href?: string;
        };
        if (!res.ok || !data.ok || !data.href) {
          setError(data.message ?? "Something went wrong. Please try again.");
          return;
        }
        onSuccess?.();
        router.push(data.href);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [prompt, router, onSuccess],
  );

  const isHero = variant === "hero";

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={
          isHero
            ? "rounded-3xl border-2 border-foreground/20 bg-background/80 p-3 shadow-lg backdrop-blur-md transition-colors focus-within:border-ring focus-within:shadow-xl sm:p-4"
            : "rounded-2xl border border-border bg-muted/15 p-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:rounded-3xl sm:p-4"
        }
      >
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-ring" aria-hidden />
          Describe your dream home
        </label>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          rows={isHero ? 3 : 2}
          maxLength={500}
          placeholder='e.g. "Quiet 3-bed near Warner Robins under $400k, modern feel, garage"'
          className={`w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none ${
            isHero ? "min-h-[88px] text-base sm:text-lg" : "min-h-[72px] text-base"
          }`}
          aria-label="Describe your dream home"
          disabled={loading}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            We apply MLS amenity filters when available, then rank by remarks.
          </p>
          <button
            type="submit"
            disabled={loading || prompt.trim().length < 8}
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] sm:min-h-[44px] sm:px-6 ${
              isHero ? "sm:text-base" : ""
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Finding…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Find homes
              </>
            )}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
