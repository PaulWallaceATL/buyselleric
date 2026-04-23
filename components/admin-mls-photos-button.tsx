"use client";

import { useState } from "react";

export function AdminMlsPhotosButton() {
  const [running, setRunning] = useState(false);
  const [runningDebug, setRunningDebug] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mls/photos?limit=200", { method: "POST" });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setRunning(false);
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
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
      >
        {running ? "Fetching photos…" : "Fetch photos for 200 listings"}
      </button>
      <button
        type="button"
        onClick={handleDebug}
        disabled={runningDebug}
        className="ml-3 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
      >
        {runningDebug ? "Probing RETS…" : "Debug Media RETS (1 listing)"}
      </button>
      {result && (
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
          {result}
        </pre>
      )}
    </div>
  );
}
