import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MlsListingData } from "@/lib/rets-client";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const jar = await cookies();
    const adminToken = jar.get(ADMIN_COOKIE_NAME)?.value;
    const isAdmin = verifyAdminSession(adminToken);
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isAdmin && !isCron) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.RETS_LOGIN_URL || !process.env.RETS_USERNAME || !process.env.RETS_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "RETS credentials not configured. Set RETS_LOGIN_URL, RETS_USERNAME, RETS_PASSWORD in Vercel." },
        { status: 500 },
      );
    }

    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
    }

    let logId: string | undefined;
    try {
      const { data: logRow } = await client
        .from("mls_sync_log")
        .insert({ status: "running" })
        .select("id")
        .single();
      logId = logRow?.id;
    } catch {
      // mls_sync_log table may not exist yet -- continue without logging
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFetched = 0;
    const syncTimestamp = new Date().toISOString();

    const { searchActiveListings, fetchPhotoUrls } = await import("@/lib/rets-client");

    let offset = 0;
    const batchSize = 2500;
    let hasMore = true;

    while (hasMore) {
      const result = await searchActiveListings(offset, batchSize);
      const SOLD_STATUSES = new Set(["sold", "closed", "withdrawn", "expired", "cancelled", "canceled"]);
      const records = result.records.filter((r) => r.mls_id && !SOLD_STATUSES.has(r.status.toLowerCase()));
      totalFetched += records.length;

      if (records.length > 0) {
        for (const record of records.slice(0, 50)) {
          if (record.mls_id && record.image_urls.length === 0) {
            try {
              record.image_urls = await fetchPhotoUrls(record.mls_id, 1);
            } catch { /* skip photo errors */ }
          }
        }
        const { inserted, updated } = await upsertBatch(client, records, syncTimestamp);
        totalInserted += inserted;
        totalUpdated += updated;
      }

      hasMore = result.hasMore;
      offset += batchSize;

      if (offset > 200000) break;
    }

    let deactivated = 0;
    try {
      const deactivateResult = await client
        .from("mls_listings")
        .update({ status: "inactive" })
        .lt("synced_at", syncTimestamp)
        .eq("status", "active")
        .select("id");
      deactivated = deactivateResult.data?.length ?? 0;
    } catch {
      // mls_listings table may be empty or not exist
    }

    if (logId) {
      try {
        await client
          .from("mls_sync_log")
          .update({
            status: "completed",
            finished_at: new Date().toISOString(),
            inserted: totalInserted,
            updated: totalUpdated,
            deactivated,
            total_fetched: totalFetched,
          })
          .eq("id", logId);
      } catch { /* ignore log failures */ }
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      updated: totalUpdated,
      deactivated,
      total_fetched: totalFetched,
    });
  } catch (err) {
    console.error("MLS sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return NextResponse.json({ ok: false, error: message, stack }, { status: 500 });
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
