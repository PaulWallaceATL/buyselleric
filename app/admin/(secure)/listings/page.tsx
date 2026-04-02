import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";
import { adminListListings, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminListingsPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const listings = client ? await adminListListings(client) : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, publish, and remove homes.</p>
        </div>
        <Link
          href="/admin/listings/new"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          New listing
        </Link>
      </div>

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : listings.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No listings yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-border rounded-2xl border border-border">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div>
                <p className="font-medium text-foreground">{l.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPriceUsd(l.price_cents)} · {l.slug}
                  {l.is_published ? "" : " · draft"}
                </p>
              </div>
              <Link
                href={`/admin/listings/${l.id}/edit`}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
