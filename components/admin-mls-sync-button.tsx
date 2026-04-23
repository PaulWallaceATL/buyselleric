"use client";

import { useState } from "react";

/** Smaller pages stay under Vercel timeouts (merge + upsert + RETS). */
const BATCH_SIZE = 400;
/** Pause between chunks to ease rate limits. */
const PAUSE_MS = 350;
/** Safety cap for one browser session. */
const MAX_BATCHES = 400;

type SyncChunkResponse = {
  ok?: boolean;
  error?: string;
  stack?: string;
  done?: boolean;
  next_offset?: number;
  sync_timestamp?: string;
  batch_rets_rows?: number;
  batch_active_rows?: number;
  inserted?: number;
  updated?: number;
  deactivated?: number;
  rets_total_matches?: number;
  photos_during_sync?: string;
  message?: string;
};

export function AdminMlsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    const lines: string[] = [];
    let syncTimestamp: string | undefined;
    let offset = 0;
    let sumUpserted = 0;
    let sumRetsRows = 0;
    let lastDeactivated = 0;
    let retsTotal: number | undefined;
    let photosMode: string | undefined;

    try {
      for (let batchNum = 1; batchNum <= MAX_BATCHES; batchNum++) {
        setResult(`Running batch ${batchNum} (offset ${offset})…`);

        const res = await fetch("/api/mls/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset,
            batch_size: BATCH_SIZE,
            ...(syncTimestamp ? { sync_timestamp: syncTimestamp } : {}),
          }),
        });

        const text = await res.text();
        let data: SyncChunkResponse;
        try {
          data = JSON.parse(text) as SyncChunkResponse;
        } catch {
          setResult(`Server error (${res.status}): ${text.slice(0, 400)}`);
          return;
        }

        if (!data.ok) {
          setResult(`Sync failed (batch ${batchNum}): ${data.error ?? "Unknown"}${data.stack ? `\n${data.stack}` : ""}`);
          return;
        }

        if (typeof data.sync_timestamp === "string") syncTimestamp = data.sync_timestamp;
        if (typeof data.rets_total_matches === "number") retsTotal = data.rets_total_matches;
        if (typeof data.photos_during_sync === "string") photosMode = data.photos_during_sync;

        sumUpserted += Number(data.inserted ?? 0);
        sumRetsRows += Number(data.batch_rets_rows ?? 0);
        lastDeactivated = Number(data.deactivated ?? 0);
        offset = Number(data.next_offset ?? 0);

        lines.push(
          `Batch ${batchNum}: ${data.batch_rets_rows ?? 0} RETS rows, ${data.batch_active_rows ?? 0} active, ${data.inserted ?? 0} upserted`,
        );

        if (data.message) lines.push(`  → ${data.message}`);

        if (data.done) {
          lines.push(
            `—`,
            `Finished. ~${retsTotal ?? "?"} matches reported by RETS, ${sumRetsRows} RETS rows pulled in this run, ${sumUpserted} row upserts, ${lastDeactivated} listings marked inactive (no longer in feed).`,
          );
          if (photosMode === "skipped_large_feed") {
            lines.push(`Photos were skipped (large feed). Use “Fetch all photos (batched)” to backfill images.`);
          }
          setResult(lines.join("\n"));
          return;
        }

        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }

      setResult(
        `${lines.join("\n")}\n—\nStopped after ${MAX_BATCHES} batches (${MAX_BATCHES * BATCH_SIZE} max rows) as a safety limit. Click Sync again — use offset ${offset} in API if we add resume, or increase MAX_BATCHES in code.`,
      );
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {syncing ? "Syncing… (batched)" : "Sync now"}
      </button>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Pulls up to {BATCH_SIZE.toLocaleString()} listings per HTTP request (with a short pause between requests) until
        RETS reports the feed is complete.
        Same <code className="rounded bg-muted px-1">mls_id</code> is upserted, so there are no duplicates.
      </p>
      {result && (
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
          {result}
        </pre>
      )}
    </div>
  );
}
