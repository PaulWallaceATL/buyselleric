import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { searchActiveListings, type MlsListingData } from "@/lib/rets-client";

export const maxDuration = 300;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: logRow } = await client
    .from("mls_sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();
  const logId = logRow?.id;

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFetched = 0;
  const syncTimestamp = new Date().toISOString();

  try {
    let offset = 0;
    const batchSize = 2500;
    let hasMore = true;

    while (hasMore) {
      const result = await searchActiveListings(offset, batchSize);
      const records = result.records.filter((r) => r.mls_id);
      totalFetched += records.length;

      if (records.length > 0) {
        const { inserted, updated } = await upsertBatch(client, records, syncTimestamp);
        totalInserted += inserted;
        totalUpdated += updated;
      }

      hasMore = result.hasMore;
      offset += batchSize;

      if (offset > 200000) break;
    }

    const deactivateResult = await client
      .from("mls_listings")
      .update({ status: "inactive" })
      .lt("synced_at", syncTimestamp)
      .eq("status", "active")
      .select("id");
    const deactivated = deactivateResult.data?.length ?? 0;

    if (logId) {
      await client
        .from("mls_sync_log")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          inserted: totalInserted,
          updated: totalUpdated,
          deactivated: deactivated ?? 0,
          total_fetched: totalFetched,
        })
        .eq("id", logId);
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      updated: totalUpdated,
      deactivated: deactivated ?? 0,
      total_fetched: totalFetched,
    });
  } catch (err) {
    console.error("MLS sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    if (logId) {
      await client
        .from("mls_sync_log")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: message,
          total_fetched: totalFetched,
          inserted: totalInserted,
          updated: totalUpdated,
        })
        .eq("id", logId);
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function upsertBatch(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  records: MlsListingData[],
  syncTimestamp: string,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  const chunkSize = 500;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const rows = chunk.map((r) => ({
      ...r,
      status: "active",
      synced_at: syncTimestamp,
    }));

    const { data, error } = await client
      .from("mls_listings")
      .upsert(rows, { onConflict: "mls_id", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.error("Upsert batch error:", error.message);
      continue;
    }

    const count = data?.length ?? 0;
    updated += count;
    inserted += count;
  }

  return { inserted, updated };
}
