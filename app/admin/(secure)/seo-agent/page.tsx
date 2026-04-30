import Link from "next/link";
import { SeoAgentRunButton } from "@/components/seo-agent-run-button";
import {
  adminGetLatestSeoAgentRunSummary,
  adminListSeoAgentActivity,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import { isSeoAgentEnabled, seoAgentModel } from "@/lib/seo-agent/config";
import type { SeoAgentActivityRow } from "@/lib/types/db";
import type { ReactNode } from "react";

export default async function AdminSeoAgentPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  let activity: SeoAgentActivityRow[] = [];
  let activityError: string | null = null;
  let lastRun: { run_id: string; created_at: string } | null = null;

  if (client) {
    try {
      activity = await adminListSeoAgentActivity(client, { limit: 100 });
    } catch (e) {
      activityError = e instanceof Error ? e.message : "Could not load activity log.";
    }
    try {
      lastRun = await adminGetLatestSeoAgentRunSummary(client);
    } catch {
      lastRun = null;
    }
  }

  const enabled = isSeoAgentEnabled();
  const model = seoAgentModel();

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-foreground">AI SEO agent</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Web research (OpenAI + browsing), longform drafts with covers, and featured listing posts. Activity is logged
        below.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-muted/15 p-6">
        <h2 className="text-sm font-semibold text-foreground">Status</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">SEO_AGENT_ENABLED</dt>
            <dd className="font-medium text-foreground">{enabled ? "true (runs on schedule)" : "false (cron no-op)"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Model (SEO_AGENT_MODEL)</dt>
            <dd className="font-mono text-xs text-foreground">{model}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last run start</dt>
            <dd className="text-foreground">
              {lastRun
                ? `${new Date(lastRun.created_at).toLocaleString()} · ${lastRun.run_id}`
                : "No runs logged yet"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Schedule</dt>
            <dd className="text-foreground">Vercel cron every 30 minutes → /api/cron/seo-agent</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5 font-mono">SEO_AGENT_ENABLED=true</code> and apply SQL in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">supabase/seo-agent-activity.sql</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">supabase/blog-post-kind-agent-seo.sql</code>.
          Optional: <code className="font-mono">SEO_AGENT_FEATURED_MLS_IDS</code>,{" "}
          <code className="font-mono">SEO_AGENT_AUTO_PUBLISH</code>.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border p-6">
        <h2 className="text-sm font-semibold text-foreground">Manual run</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Triggers the same job as the cron (research + up to your max SEO/listing posts). Can take several minutes.
        </p>
        <div className="mt-4">
          <SeoAgentRunButton />
        </div>
      </div>

      {!client ? (
        <p className="mt-10 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : activityError ? (
        <p className="mt-10 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Activity log: {activityError}
        </p>
      ) : (
        <div className="mt-10">
          <h2 className="text-lg font-medium text-foreground">Activity log</h2>
          <p className="mt-1 text-sm text-muted-foreground">Most recent 100 events.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No activity yet. Run the SQL migration, enable the agent, then run manually or wait for cron.
                    </td>
                  </tr>
                ) : (
                  activity.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.level === "error"
                              ? "text-red-600 dark:text-red-400"
                              : row.level === "warn"
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-foreground"
                          }
                        >
                          {row.level}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground">{row.kind}</td>
                      <td className="max-w-md px-4 py-3 text-foreground">{row.summary}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{row.run_id.slice(0, 8)}…</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin/blog" className="font-medium text-ring underline-offset-4 hover:underline">
          ← Blog posts
        </Link>
      </p>
    </div>
  );
}
