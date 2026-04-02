import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteListingForm } from "@/components/admin-delete-listing-form";
import { AdminListingForm } from "@/components/admin-listing-form";
import { adminGetListing, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function AdminEditListingPage({ params }: Props): Promise<ReactNode> {
  const { id } = await params;
  const client = createSupabaseAdminClient();
  if (!client) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase admin client is not configured.
      </p>
    );
  }

  const listing = await adminGetListing(client, id);
  if (!listing) {
    notFound();
  }

  return (
    <div>
      <Link href="/admin/listings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Listings
      </Link>
      <h1 className="mt-6 text-2xl font-medium tracking-tight text-foreground">Edit listing</h1>
      <p className="mt-2 text-sm text-muted-foreground">{listing.title}</p>
      <div className="mt-10">
        <AdminListingForm listing={listing} />
      </div>
      <AdminDeleteListingForm listingId={listing.id} />
    </div>
  );
}
