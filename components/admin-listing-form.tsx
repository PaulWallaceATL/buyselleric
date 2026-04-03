"use client";

import { useActionState } from "react";
import { adminSaveListing } from "@/app/actions/admin";
import type { ListingRow, ListingStatus } from "@/lib/types/db";
import { AdminListingImageRows } from "@/components/admin-listing-image-rows";

const statuses: ListingStatus[] = ["draft", "available", "pending", "sold"];

function fieldClass() {
  return "w-full rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus-ring outline-none";
}

export function AdminListingForm({ listing }: { listing?: ListingRow }) {
  const [state, formAction, pending] = useActionState(adminSaveListing, null);

  const priceUsd =
    listing !== undefined ? (listing.price_cents / 100).toFixed(0) : "";
  const initialImageUrls = listing?.image_urls ?? [];

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}

      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={listing?.title}
            className={fieldClass()}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="slug" className="mb-1 block text-sm font-medium">
            URL slug (optional)
          </label>
          <input
            id="slug"
            name="slug"
            placeholder="auto from title if empty"
            defaultValue={listing?.slug}
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor="price_usd" className="mb-1 block text-sm font-medium">
            Price (USD)
          </label>
          <input
            id="price_usd"
            name="price_usd"
            required
            inputMode="decimal"
            placeholder="850000"
            defaultValue={priceUsd}
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={listing?.status ?? "draft"}
            className={fieldClass()}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bedrooms" className="mb-1 block text-sm font-medium">
            Bedrooms
          </label>
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={listing?.bedrooms ?? 0}
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className="mb-1 block text-sm font-medium">
            Bathrooms
          </label>
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            step={0.5}
            defaultValue={listing?.bathrooms ?? 0}
            className={fieldClass()}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="square_feet" className="mb-1 block text-sm font-medium">
            Square feet (optional)
          </label>
          <input
            id="square_feet"
            name="square_feet"
            type="number"
            min={0}
            placeholder="2400"
            defaultValue={listing?.square_feet ?? ""}
            className={fieldClass()}
          />
        </div>
      </div>

      <div>
        <label htmlFor="address_line" className="mb-1 block text-sm font-medium">
          Street address
        </label>
        <input
          id="address_line"
          name="address_line"
          defaultValue={listing?.address_line}
          className={fieldClass()}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="city" className="mb-1 block text-sm font-medium">
            City
          </label>
          <input id="city" name="city" defaultValue={listing?.city} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="state" className="mb-1 block text-sm font-medium">
            State
          </label>
          <input id="state" name="state" defaultValue={listing?.state} className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="postal_code" className="mb-1 block text-sm font-medium">
            ZIP
          </label>
          <input
            id="postal_code"
            name="postal_code"
            defaultValue={listing?.postal_code}
            className={fieldClass()}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={listing?.description}
          className={`${fieldClass()} min-h-[140px] resize-y`}
        />
      </div>

      <div>
        <span className="mb-3 block text-sm font-medium">Photos</span>
        <AdminListingImageRows initialUrls={initialImageUrls} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={listing?.is_published ?? false}
          className="size-4 rounded border-border"
        />
        Published on public site
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity focus-ring outline-none"
      >
        {pending ? "Saving…" : listing ? "Update listing" : "Create listing"}
      </button>
    </form>
  );
}
