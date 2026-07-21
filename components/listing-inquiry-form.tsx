"use client";

import { useActionState, useEffect, useState } from "react";
import { submitListingInquiry } from "@/app/actions/listing-inquiry";
import { ctaPrimary } from "@/lib/cta-styles";
import { siteConfig } from "@/lib/config";
import { formatDreamBriefMessage, readDreamBriefSnapshot } from "@/lib/dream-brief-storage";

function fieldClass() {
  return "w-full min-h-[48px] rounded-xl border border-border/80 bg-background/80 px-4 py-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground transition-[border-color,box-shadow] focus-ring outline-none focus:border-ring/50 focus:shadow-md sm:rounded-2xl";
}

function labelClass() {
  return "mb-1.5 block text-sm font-medium text-foreground";
}

type ListingInquiryFormProps = {
  listingSource: "manual" | "mls";
  listingId: string;
  listingTitle: string;
  listingPath: string;
};

export function ListingInquiryForm({
  listingSource,
  listingId,
  listingTitle,
  listingPath,
}: ListingInquiryFormProps) {
  const [state, formAction, pending] = useActionState(submitListingInquiry, null);
  const [messagePrefill, setMessagePrefill] = useState("");

  useEffect(() => {
    const snap = readDreamBriefSnapshot();
    if (snap) setMessagePrefill(formatDreamBriefMessage(snap));
  }, []);

  if (state?.ok === true) {
    return (
      <div
        id="inquiry"
        className="rounded-2xl border border-border/70 bg-muted/20 p-6 text-center sm:rounded-3xl sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sent
        </p>
        <p className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Eric will follow up soon.
        </p>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
          Your showing request is in. Prefer to talk now?
        </p>
        <a href={`tel:${siteConfig.phoneTel}`} className={`${ctaPrimary} mt-6`}>
          Call {siteConfig.phoneDisplay}
        </a>
      </div>
    );
  }

  return (
    <form
      id="inquiry"
      action={formAction}
      className="rounded-2xl border border-border/70 bg-muted/15 p-6 sm:rounded-3xl sm:p-8"
    >
      <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
        Request a showing
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        Tell Eric when you&apos;d like to see this home. He replies personally.
      </p>

      <input type="hidden" name="listing_source" value={listingSource} />
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="listing_title" value={listingTitle} />
      <input type="hidden" name="listing_path" value={listingPath} />

      {state?.ok === false ? (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="inq_full_name" className={labelClass()}>
            Full name
          </label>
          <input
            id="inq_full_name"
            name="full_name"
            required
            autoComplete="name"
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor="inq_email" className={labelClass()}>
            Email
          </label>
          <input
            id="inq_email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor="inq_phone" className={labelClass()}>
            Phone
          </label>
          <input
            id="inq_phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={fieldClass()}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="inq_preferred_times" className={labelClass()}>
            Preferred times
          </label>
          <input
            id="inq_preferred_times"
            name="preferred_times"
            placeholder="e.g. Weekday evenings, Saturday morning"
            className={fieldClass()}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="inq_message" className={labelClass()}>
            Message
          </label>
          <textarea
            id="inq_message"
            name="message"
            rows={3}
            defaultValue={messagePrefill}
            key={messagePrefill ? "prefilled" : "empty"}
            placeholder="Questions about the home, financing, neighborhood…"
            className={`${fieldClass()} min-h-[96px] resize-y`}
          />
          {messagePrefill ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Prefilled from your dream-home preference brief — edit freely.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={pending} className={`${ctaPrimary} disabled:opacity-50`}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <p className="text-sm text-muted-foreground sm:max-w-[14rem] sm:text-right">
          Or call {siteConfig.phoneDisplay}
        </p>
      </div>
    </form>
  );
}
