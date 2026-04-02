import Link from "next/link";
import {
  adminListListings,
  adminListSubmissions,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminDashboardPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  let listingCount = 0;
  let newLeads = 0;
  if (client) {
    const [listings, subs] = await Promise.all([
      adminListListings(client),
      adminListSubmissions(client),
    ]);
    listingCount = listings.length;
    newLeads = subs.filter((s) => s.admin_status === "new").length;
  }

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-foreground">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage published homes and seller inquiries.
      </p>

      {!client ? (
        <p className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_URL
          </code>
          ,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>
          , and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          on Vercel to enable the admin API.
        </p>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/listings"
          className="rounded-2xl border border-border bg-muted/20 p-6 transition-colors hover:bg-muted/40"
        >
          <p className="text-sm text-muted-foreground">Listings</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{listingCount}</p>
          <p className="mt-2 text-sm font-medium text-foreground">Manage homes →</p>
        </Link>
        <Link
          href="/admin/submissions"
          className="rounded-2xl border border-border bg-muted/20 p-6 transition-colors hover:bg-muted/40"
        >
          <p className="text-sm text-muted-foreground">New seller leads</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{newLeads}</p>
          <p className="mt-2 text-sm font-medium text-foreground">View submissions →</p>
        </Link>
      </div>
    </div>
  );
}
