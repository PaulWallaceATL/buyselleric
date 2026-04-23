"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type BackfillState = {
  enabled: boolean;
  after_id: string;
  rounds_completed: number;
  listings_updated: number;
  last_message: string | null;
  last_error: string | null;
  updated_at: string;
};

export function AdminMlsPhotoBackfillPanel() {
  const router = useRouter();
  const [state, setState] = useState<BackfillState | null | undefined>(undefined);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mls/photos-background");
    const j = (await res.json()) as {
      ok?: boolean;
      state?: BackfillState | null;
      hint?: string;
      error?: string;
    };
    if (j.hint) setHint(j.hint);
    if (!j.ok) {
      setHint((prev) => j.error ?? j.hint ?? prev);
      setState(null);
      return;
    }
    setState(j.state ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state?.enabled) return;
    const t = setInterval(() => {
      void load();
      router.refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [state?.enabled, load, router]);

  async function post(action: "start" | "stop" | "reset") {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/mls/photos-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string; hint?: string };
      if (j.hint) setHint(j.hint);
      setMsg(j.ok ? (j.message ?? "OK") : (j.error ?? "Request failed"));
      await load();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (state === undefined) {
    return <p className="text-sm text-muted-foreground">Loading background job state…</p>;
  }

  if (state === null) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">Background job table not ready</p>
        <p className="mt-1 text-muted-foreground">
          Run <code className="rounded bg-muted px-1 text-xs">supabase/mls-photo-backfill-state.sql</code> in the
          Supabase SQL editor, then refresh this page.
        </p>
        {hint ? <p className="mt-2 text-xs opacity-90">{hint}</p> : null}
      </div>
    );
  }

  const cursorShort = state.after_id ? `${state.after_id.slice(0, 8)}…` : "—";

  return (
    <div className="rounded-2xl border border-border bg-muted/15 p-4 sm:p-5">
      <h3 className="text-base font-semibold text-foreground">Background photo backfill</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        When <span className="font-medium text-foreground">running</span>, Vercel Cron calls{" "}
        <code className="rounded bg-muted px-1 text-xs">/api/cron/mls-photo-backfill</code> every 3 minutes. Each run
        saves progress in the database, so you can close this tab or refresh — work continues until the queue is empty
        or you stop it. Requires <code className="rounded bg-muted px-1 text-xs">CRON_SECRET</code> on Vercel (same as
        MLS sync).
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Job status</dt>
          <dd className="font-medium text-foreground">{state.enabled ? "Running" : "Idle / finished"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cron rounds</dt>
          <dd className="font-medium tabular-nums text-foreground">{state.rounds_completed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rows updated (cumulative)</dt>
          <dd className="font-medium tabular-nums text-foreground">{Number(state.listings_updated).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cursor</dt>
          <dd className="font-mono text-xs text-foreground">{cursorShort}</dd>
        </div>
      </dl>
      {state.last_message ? (
        <p className="mt-3 rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          {state.last_message}
        </p>
      ) : null}
      {state.last_error ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {state.last_error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || state.enabled}
          onClick={() => void post("start")}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          Start background
        </button>
        <button
          type="button"
          disabled={loading || !state.enabled}
          onClick={() => void post("stop")}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
        >
          Stop
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void post("reset")}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
        >
          Reset cursor &amp; enable
        </button>
      </div>
      {msg ? <p className="mt-3 text-sm text-foreground">{msg}</p> : null}
    </div>
  );
}
