"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  adminClearFeaturedSlot,
  adminSaveFeaturedSlot,
  adminSearchMlsForFeatured,
  type AdminFeaturedSlotState,
  type AdminMlsSearchHit,
} from "@/app/actions/admin";
import { formatPriceUsd } from "@/lib/format";
import type { FeaturedSlotRow, ListingRow } from "@/lib/types/db";

type SlotDraft = {
  source: "mls" | "manual";
  mls_id: string;
  listing_id: string;
  mls_label: string;
};

function slotFromRow(row: FeaturedSlotRow | undefined): SlotDraft {
  if (!row) {
    return { source: "manual", mls_id: "", listing_id: "", mls_label: "" };
  }
  return {
    source: row.source,
    mls_id: row.mls_id ?? "",
    listing_id: row.listing_id ?? "",
    mls_label: row.mls_id ? `MLS #${row.mls_id}` : "",
  };
}

function FeaturedSlotEditor({
  slotIndex,
  initial,
  manuals,
}: {
  slotIndex: number;
  initial: FeaturedSlotRow | undefined;
  manuals: ListingRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SlotDraft>(() => slotFromRow(initial));
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<AdminMlsSearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [clearing, startClear] = useTransition();
  const [state, formAction, pending] = useActionState(
    async (prev: AdminFeaturedSlotState, formData: FormData) => {
      const result = await adminSaveFeaturedSlot(prev, formData);
      if (result?.ok) router.refresh();
      return result;
    },
    null as AdminFeaturedSlotState,
  );

  function runSearch() {
    startSearch(async () => {
      const results = await adminSearchMlsForFeatured(searchQ);
      setHits(results);
    });
  }

  function pickMls(hit: AdminMlsSearchHit) {
    setDraft((d) => ({
      ...d,
      source: "mls",
      mls_id: hit.mls_id,
      listing_id: "",
      mls_label: `${hit.address_line || hit.title} · MLS #${hit.mls_id}`,
    }));
    setHits([]);
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">Slot {slotIndex}</h2>
        {initial ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => {
              startClear(async () => {
                await adminClearFeaturedSlot(slotIndex);
                setDraft({ source: "manual", mls_id: "", listing_id: "", mls_label: "" });
                router.refresh();
              });
            }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear slot"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, source: "manual", mls_id: "", mls_label: "" }))}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            draft.source === "manual"
              ? "bg-foreground text-background"
              : "border border-border text-foreground hover:bg-muted/40"
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, source: "mls", listing_id: "" }))}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            draft.source === "mls"
              ? "bg-foreground text-background"
              : "border border-border text-foreground hover:bg-muted/40"
          }`}
        >
          MLS
        </button>
      </div>

      {draft.source === "manual" ? (
        <label className="mt-4 block text-sm">
          <span className="text-muted-foreground">Published listing</span>
          <select
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground"
            value={draft.listing_id}
            onChange={(e) => setDraft((d) => ({ ...d, listing_id: e.target.value }))}
          >
            <option value="">Select a listing…</option>
            {manuals.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} {l.is_published ? "" : "(draft)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="mt-4 space-y-3">
          {draft.mls_id ? (
            <p className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
              Selected: <span className="font-medium">{draft.mls_label || `MLS #${draft.mls_id}`}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Search MLS and click a result to assign this slot.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Address, city, or MLS #"
              className="w-full flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || searchQ.trim().length < 2}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search MLS"}
            </button>
          </div>
          {hits.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {hits.map((hit) => (
                <li key={hit.mls_id}>
                  <button
                    type="button"
                    onClick={() => pickMls(hit)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {hit.address_line || hit.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatPriceUsd(hit.price_cents)} · {hit.bedrooms} bd · {hit.bathrooms} ba ·{" "}
                        {hit.city} · MLS #{hit.mls_id}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ring">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <form action={formAction} className="mt-5">
        <input type="hidden" name="slot_index" value={slotIndex} />
        <input type="hidden" name="source" value={draft.source} />
        <input type="hidden" name="mls_id" value={draft.mls_id} />
        <input type="hidden" name="listing_id" value={draft.listing_id} />
        <button
          type="submit"
          disabled={
            pending ||
            (draft.source === "mls" ? !draft.mls_id : !draft.listing_id)
          }
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save slot"}
        </button>
        {state?.ok === false ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.message}</p>
        ) : null}
        {state?.ok === true ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
        ) : null}
      </form>
    </div>
  );
}

export function AdminFeaturedSlotsForm({
  slots,
  manuals,
}: {
  slots: FeaturedSlotRow[];
  manuals: ListingRow[];
}) {
  const byIndex = new Map(slots.map((s) => [s.slot_index, s]));

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-1 xl:grid-cols-3">
      {[1, 2, 3].map((slotIndex) => (
        <FeaturedSlotEditor
          key={slotIndex}
          slotIndex={slotIndex}
          initial={byIndex.get(slotIndex)}
          manuals={manuals}
        />
      ))}
    </div>
  );
}
