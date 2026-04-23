import { AdminMlsPhotoBackfillPanel } from "@/components/admin-mls-photo-backfill-panel";
import { AdminMlsPhotosButton } from "@/components/admin-mls-photos-button";
import { AdminMlsSyncButton } from "@/components/admin-mls-sync-button";
import { mlsSyncStaleCutoffIso } from "@/lib/mls-sync-stale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MlsSyncLogRow } from "@/lib/types/db";
import type { ReactNode } from "react";

export default async function AdminMlsPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();

  let totalListings = 0;
  let activeListings = 0;
  let recentSyncs: MlsSyncLogRow[] = [];

  if (client) {
    const staleMinutes = Math.min(
      24 * 60,
      Math.max(30, Number.parseInt(process.env.MLS_SYNC_STALE_MINUTES ?? "240", 10)),
    );
    const staleCutoff = mlsSyncStaleCutoffIso(staleMinutes);
    const { error: staleErr } = await client
      .from("mls_sync_log")
      .update({
        status: "failed",
        error: "Stale running entry (timeout, tab closed, or interrupted sync).",
        finished_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .is("finished_at", null)
      .lt("started_at", staleCutoff);
    if (staleErr) console.error("mls_sync_log stale cleanup:", staleErr.message);

    const [countResult, activeResult, logResult] = await Promise.all([
      client.from("mls_listings").select("id", { count: "exact", head: true }).then((r) => r),
      client.from("mls_listings").select("id", { count: "exact", head: true }).eq("status", "active").then((r) => r),
      client.from("mls_sync_log").select("*").order("started_at", { ascending: false }).limit(10).then((r) => r),
    ]).catch(() => [
      { count: 0 },
      { count: 0 },
      { data: [] },
    ] as [{ count: number | null }, { count: number | null }, { data: MlsSyncLogRow[] | null }]);

    totalListings = (countResult as { count: number | null }).count ?? 0;
    activeListings = (activeResult as { count: number | null }).count ?? 0;
    recentSyncs = ((logResult as { data: MlsSyncLogRow[] | null }).data ?? []) as MlsSyncLogRow[];
  }

  const hasRetsConfig = !!(process.env.RETS_LOGIN_URL && process.env.RETS_USERNAME && process.env.RETS_PASSWORD);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">MLS Feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">GAMLS RETS integration — synced listings from the Georgia MLS.</p>
        </div>
        <div className="flex flex-col gap-3">
          <AdminMlsSyncButton />
          <AdminMlsPhotosButton />
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <AdminMlsPhotoBackfillPanel />
      </div>

      {!hasRetsConfig && (
        <p className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">RETS_LOGIN_URL</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">RETS_USERNAME</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">RETS_PASSWORD</code>, and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">CRON_SECRET</code>{" "}
          in your Vercel environment variables to enable MLS sync.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total MLS listings</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalListings.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{activeListings.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last sync</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {recentSyncs[0]
              ? new Date(recentSyncs[0].started_at).toLocaleString()
              : "Never"}
          </p>
        </div>
      </div>

      {recentSyncs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Sync history</h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {recentSyncs.map((s) => (
              <li key={s.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(s.started_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.total_fetched} fetched · {s.inserted} inserted · {s.updated} updated · {s.deactivated} deactivated
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      s.status === "completed"
                        ? "bg-green-500/10 text-green-700 dark:text-green-300"
                        : s.status === "failed"
                          ? "bg-red-500/10 text-red-700 dark:text-red-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.error && (
                  <p className="mt-2 rounded bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    {s.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
