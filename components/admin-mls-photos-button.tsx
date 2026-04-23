"use client";

import { useState } from "react";

/** Keep each request under server time limits (RETS round-trip per listing). */
const PHOTO_BATCH = 28;
const MAX_PHOTO_ROUNDS = 2000;

type PhotoChunk = {
  ok?: boolean;
  error?: string;
  done?: boolean;
  after_id?: string;
  checked?: number;
  updated?: number;
  fetchedZero?: number;
  errors?: number;
  errorSamples?: string[];
  message?: string;
  used_rpc?: boolean;
};

export function AdminMlsPhotosButton() {
  const [running, setRunning] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [runningDebug, setRunningDebug] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleOneBatch() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mls/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_size: PHOTO_BATCH }),
      });
      const data = (await res.json()) as PhotoChunk;
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleFetchAllPhotos() {
    setRunningAll(true);
    setResult(null);
    const lines: string[] = [];
    let afterId = "";
    let sumUpdated = 0;
    let sumChecked = 0;

    try {
      for (let i = 1; i <= MAX_PHOTO_ROUNDS; i++) {
        setResult(`Photo batch ${i}… (cursor ${afterId || "start"})`);

        const res = await fetch("/api/admin/mls/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(afterId ? { after_id: afterId } : {}),
            batch_size: PHOTO_BATCH,
          }),
        });
        const data = (await res.json()) as PhotoChunk;

        if (!data.ok) {
          const retriable = res.status === 504 || res.status === 502 || res.status === 503;
          if (retriable && i < MAX_PHOTO_ROUNDS) {
            lines.push(`Round ${i}: HTTP ${res.status}, retrying once after pause…`);
            await new Promise((r) => setTimeout(r, 4000));
            const retry = await fetch("/api/admin/mls/photos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(afterId ? { after_id: afterId } : {}),
                batch_size: PHOTO_BATCH,
              }),
            });
            const retryData = (await retry.json()) as PhotoChunk;
            if (retryData.ok) {
              sumUpdated += Number(retryData.updated ?? 0);
              sumChecked += Number(retryData.checked ?? 0);
              afterId = typeof retryData.after_id === "string" ? retryData.after_id : afterId;
              lines.push(
                `Round ${i} (retry): checked ${retryData.checked ?? 0}, updated ${retryData.updated ?? 0}, done ${String(retryData.done)}`,
              );
              if (retryData.done) {
                lines.push(`—`, `Finished after retry on round ${i}.`);
                setResult(lines.join("\n"));
                return;
              }
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
          }
          setResult(`Failed on round ${i}: ${data.error ?? "Unknown"}\n${lines.join("\n")}`);
          return;
        }

        sumUpdated += Number(data.updated ?? 0);
        sumChecked += Number(data.checked ?? 0);
        afterId = typeof data.after_id === "string" ? data.after_id : afterId;

        lines.push(
          `Round ${i}: checked ${data.checked ?? 0}, updated ${data.updated ?? 0}, zero ${data.fetchedZero ?? 0}, errors ${data.errors ?? 0}${data.used_rpc === false ? " (fallback scan)" : ""}`,
        );
        if (data.message) lines.push(`  → ${data.message}`);

        if (data.done) {
          lines.push(
            `—`,
            `Finished after ${i} round(s). Updated ~${sumUpdated} listings, ${sumChecked} rows examined in last rounds.`,
          );
          setResult(lines.join("\n"));
          return;
        }

        await new Promise((r) => setTimeout(r, 150));
      }

      setResult(
        `${lines.join("\n")}\n—\nStopped after ${MAX_PHOTO_ROUNDS} rounds (safety). Cursor id: ${afterId}. Click again to continue.`,
      );
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setRunningAll(false);
    }
  }

  async function handleDebug() {
    setRunningDebug(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mls/photos?debug=1", { method: "POST" });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setRunningDebug(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleFetchAllPhotos}
          disabled={runningAll || running || runningDebug}
          className="rounded-full border border-border bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {runningAll ? "Fetching all photos…" : "Fetch all photos (batched)"}
        </button>
        <button
          type="button"
          onClick={handleOneBatch}
          disabled={running || runningAll || runningDebug}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
        >
          {running ? "Fetching…" : `One photo batch (~${PHOTO_BATCH})`}
        </button>
        <button
          type="button"
          onClick={handleDebug}
          disabled={runningDebug || running || runningAll}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
        >
          {runningDebug ? "Probing RETS…" : "Debug Media RETS"}
        </button>
      </div>
      <p className="max-w-xl text-sm text-muted-foreground">
        Each server request uses one RETS session and processes up to {PHOTO_BATCH} listings without images (longer
        timeout on Vercel). Listings with no RETS media are marked so the queue can advance. Run{" "}
        <code className="rounded bg-muted px-1 text-xs">supabase/mls-listings-missing-photos-rpc.sql</code> in Supabase
        for fastest paging.
      </p>
      {result && (
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
          {result}
        </pre>
      )}
    </div>
  );
}
