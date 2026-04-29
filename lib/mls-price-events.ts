import type { MlsListingData } from "@/lib/rets-client";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function minPriceDropPct(): number {
  const raw = process.env.LISTING_BLOG_MIN_PRICE_DROP_PCT ?? "3";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/**
 * During MLS sync, record meaningful list-price reductions for the listing-blog cron.
 * Deduped in DB by UNIQUE (mls_id, to_price_cents).
 */
export async function insertPriceDropEventsForBatch(
  client: AdminClient,
  incoming: MlsListingData[],
): Promise<void> {
  if (incoming.length === 0) return;

  const pct = minPriceDropPct();
  const ids = incoming.map((r) => r.mls_id).filter(Boolean);
  if (ids.length === 0) return;

  const { data: existingRows, error } = await client
    .from("mls_listings")
    .select("mls_id, price_cents")
    .in("mls_id", ids);

  if (error) {
    console.error("insertPriceDropEventsForBatch select", error.message);
    return;
  }

  const prevPrice = new Map<string, number>();
  for (const row of existingRows ?? []) {
    const r = row as { mls_id: string; price_cents: number };
    if (r.mls_id) prevPrice.set(r.mls_id, Number(r.price_cents) || 0);
  }

  const events: { mls_id: string; from_price_cents: number; to_price_cents: number }[] = [];

  for (const r of incoming) {
    if (!r.mls_id) continue;
    const oldCents = prevPrice.get(r.mls_id);
    if (oldCents == null || oldCents <= 0) continue;
    const newCents = r.price_cents;
    if (newCents >= oldCents) continue;
    const dropPct = ((oldCents - newCents) / oldCents) * 100;
    if (dropPct + 1e-9 < pct) continue;
    events.push({
      mls_id: r.mls_id,
      from_price_cents: oldCents,
      to_price_cents: newCents,
    });
  }

  if (events.length === 0) return;

  const { error: insErr } = await client.from("mls_listing_price_events").insert(events);
  if (insErr && insErr.code !== "23505") {
    console.error("insertPriceDropEventsForBatch insert", insErr.message);
  }
}
