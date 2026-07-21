"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { submitDreamPreferenceBrief } from "@/app/actions/dream-preference-brief";
import { ctaPrimary } from "@/lib/cta-styles";
import { siteConfig } from "@/lib/config";
import { writeDreamBriefSnapshot } from "@/lib/dream-brief-storage";

function fieldClass() {
  return "w-full min-h-[44px] rounded-xl border border-border/80 bg-background/80 px-4 py-3 text-base text-foreground shadow-sm placeholder:text-muted-foreground transition-[border-color,box-shadow] focus-ring outline-none focus:border-ring/50 focus:shadow-md sm:rounded-2xl";
}

function labelClass() {
  return "mb-1.5 block text-sm font-medium text-foreground";
}

export type DreamBriefShortlistItem = {
  mlsId: string;
  title: string;
};

type DreamPreferenceBriefProps = {
  mustHaves: string[];
  softWants: string[];
  shortlist: DreamBriefShortlistItem[];
  filtersJson: Record<string, unknown>;
  dreamText?: string;
};

export function DreamPreferenceBrief({
  mustHaves,
  softWants,
  shortlist,
  filtersJson,
  dreamText = "",
}: DreamPreferenceBriefProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitDreamPreferenceBrief, null);

  const brief = useMemo(() => {
    const parts: string[] = [];
    if (dreamText.trim()) parts.push(`Buyer said: “${dreamText.trim().slice(0, 280)}”`);
    if (mustHaves.length) parts.push(`Must-haves: ${mustHaves.join("; ")}`);
    if (softWants.length) parts.push(`Also wants: ${softWants.join("; ")}`);
    if (shortlist.length) {
      parts.push(
        `Top homes on this page: ${shortlist
          .map((s) => `${s.title}${s.mlsId ? ` (MLS ${s.mlsId})` : ""}`)
          .join("; ")}`,
      );
    }
    return parts.join("\n") || "Dream-home search preference brief.";
  }, [dreamText, mustHaves, softWants, shortlist]);

  useEffect(() => {
    writeDreamBriefSnapshot({
      brief,
      filters: filtersJson,
      shortlist,
      savedAt: new Date().toISOString(),
    });
  }, [brief, filtersJson, shortlist]);

  if (state?.ok === true) {
    return (
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 sm:rounded-3xl sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sent to Eric
        </p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          He&apos;ll review your preference brief soon.
        </p>
        <a href={`tel:${siteConfig.phoneTel}`} className={`${ctaPrimary} mt-4`}>
          Call {siteConfig.phoneDisplay}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/10 p-5 sm:rounded-3xl sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Preference brief
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Share this search with Eric
      </h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Send your must-haves, soft wants, and the top homes on this page — not a generic lead form.
      </p>

      {(mustHaves.length > 0 || softWants.length > 0) && (
        <ul className="mt-4 space-y-1.5 text-sm text-foreground">
          {mustHaves.map((m) => (
            <li key={`h-${m}`}>
              <span className="text-muted-foreground">Must-have · </span>
              {m}
            </li>
          ))}
          {softWants.map((s) => (
            <li key={`s-${s}`}>
              <span className="text-muted-foreground">Also wants · </span>
              {s}
            </li>
          ))}
        </ul>
      )}

      {shortlist.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Shortlist: {shortlist.map((s) => s.title).join(" · ")}
        </p>
      ) : null}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${ctaPrimary} mt-5`}>
          Share with Eric
        </button>
      ) : (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="dream_brief" value={brief} />
          <input type="hidden" name="dream_filters" value={JSON.stringify(filtersJson)} />
          <input
            type="hidden"
            name="shortlist_mls_ids"
            value={shortlist.map((s) => s.mlsId).filter(Boolean).join("|")}
          />

          {state?.ok === false ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {state.message}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dream_brief_name" className={labelClass()}>
                Full name
              </label>
              <input
                id="dream_brief_name"
                name="full_name"
                required
                autoComplete="name"
                className={fieldClass()}
              />
            </div>
            <div>
              <label htmlFor="dream_brief_email" className={labelClass()}>
                Email
              </label>
              <input
                id="dream_brief_email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={fieldClass()}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dream_brief_phone" className={labelClass()}>
                Phone
              </label>
              <input
                id="dream_brief_phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className={fieldClass()}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dream_brief_notes" className={labelClass()}>
                Notes for Eric
              </label>
              <textarea
                id="dream_brief_notes"
                name="message"
                rows={3}
                placeholder="Timing, schools, commute, anything else…"
                className={`${fieldClass()} min-h-[88px] resize-y`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="submit" disabled={pending} className={`${ctaPrimary} disabled:opacity-50`}>
              {pending ? "Sending…" : "Send preference brief"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
