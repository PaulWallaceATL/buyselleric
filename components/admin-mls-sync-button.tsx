"use client";

import { useState } from "react";

export function AdminMlsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/mls/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${window.prompt("Enter CRON_SECRET:") || ""}` },
      });
      const data = await res.json();
      if (data.ok) {
        setResult(
          `Sync complete: ${data.total_fetched} fetched, ${data.inserted} upserted, ${data.deactivated} deactivated`,
        );
      } else {
        setResult(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Network error"}`);
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
        {syncing ? "Syncing…" : "Sync now"}
      </button>
      {result && (
        <p className="mt-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
          {result}
        </p>
      )}
    </div>
  );
}
