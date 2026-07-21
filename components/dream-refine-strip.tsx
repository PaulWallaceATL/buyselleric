"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

/** Multi-turn refine strip — posts follow-up + current URL params to dream-search. */
export function DreamRefineStrip({
  currentParams,
}: {
  currentParams: Record<string, string>;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = prompt.trim();
      if (trimmed.length < 8) {
        setError("Add a bit more — e.g. “drop the pool” or “widen to Warner Robins”.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/listings/dream-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, current: currentParams }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          href?: string;
        };
        if (!res.ok || !data.ok || !data.href) {
          setError(data.message ?? "Could not refine that search.");
          return;
        }
        setPrompt("");
        router.push(data.href);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [prompt, currentParams, router],
  );

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border/80 bg-muted/10 p-3 sm:rounded-3xl sm:p-4"
    >
      <label
        htmlFor="dream-refine-prompt"
        className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Narrow or change this search
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id="dream-refine-prompt"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. “drop the pool, keep the garage” or “widen to Houston County”'
          className="min-h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Updating…" : "Update"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
