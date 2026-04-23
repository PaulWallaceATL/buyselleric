"use client";

import { useState } from "react";

export function AdminMlsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/mls/sync", { method: "POST" });
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        setResult(`Server error (${res.status}): ${text.slice(0, 200)}`);
        return;
      }
      if (data.ok) {
        const withPhotos =
          typeof data.listings_with_photos === "number" ? ` · ${data.listings_with_photos} with photos` : "";
        const matches =
          typeof data.rets_total_matches === "number"
            ? ` · RETS total matches (reported): ${data.rets_total_matches}`
            : "";
        const photoNote =
          data.photos_during_sync === "skipped_large_feed"
            ? " · Photos skipped during sync (large feed); run “Fetch photos” in batches or raise MLS_SYNC_PHOTO_MAX_TOTAL"
            : "";
        setResult(
          `Sync complete: ${data.total_fetched} RETS rows pulled, ${typeof data.total_active_listings === "number" ? `${data.total_active_listings} active rows processed` : "rows processed"}, ${data.inserted} upserted, ${data.deactivated} deactivated${matches}${photoNote}${withPhotos}`,
        );
      } else {
        setResult(`Sync failed: ${data.error}${data.stack ? `\n${data.stack}` : ""}`);
      }
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
        {syncing ? "Syncing… (may take a few minutes)" : "Sync now"}
      </button>
      {result && (
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
          {result}
        </pre>
      )}
    </div>
  );
}
