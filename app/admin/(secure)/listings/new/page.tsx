import { AdminListingForm } from "@/components/admin-listing-form";
import type { ReactNode } from "react";

export default function AdminNewListingPage(): ReactNode {
  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-foreground">New listing</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Publish when you are ready—drafts stay hidden from the public site.
      </p>
      <div className="mt-10">
        <AdminListingForm />
      </div>
    </div>
  );
}
