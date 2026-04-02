"use client";

import { useActionState } from "react";
import { adminDeleteListingForm } from "@/app/actions/admin";

export function AdminDeleteListingForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(adminDeleteListingForm, null);

  return (
    <form action={formAction} className="mt-10 border-t border-border pt-8">
      <input type="hidden" name="id" value={listingId} />
      {state?.ok === false ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-red-600 underline-offset-4 hover:underline dark:text-red-400 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete this listing"}
      </button>
    </form>
  );
}
