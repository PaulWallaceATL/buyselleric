import Link from "next/link";
import { AdminFeaturedSlotsForm } from "@/components/admin-featured-slots-form";
import {
  adminListFeaturedSlots,
  adminListListings,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminFeaturedPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const slots = client ? await adminListFeaturedSlots(client).catch(() => []) : [];
  const manuals = client ? await adminListListings(client).catch(() => []) : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Featured homes</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Assign each homepage slot to a manual listing or an MLS property. Search MLS, click a
            result, then save.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          target="_blank"
        >
          View homepage →
        </Link>
      </div>

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : (
        <AdminFeaturedSlotsForm slots={slots} manuals={manuals} />
      )}
    </div>
  );
}
