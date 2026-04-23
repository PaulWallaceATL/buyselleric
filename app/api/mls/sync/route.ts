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
    let totalRetsRowsPulled = 0;
    let totalActiveSaved = 0;
    const syncTimestamp = new Date().toISOString();

    const {
      createRetsSession,
      searchActiveListingsWithSession,
      fetchPhotoUrlsWithSession,
      MLS_MEDIA_MAX_URLS,
    } = await import("@/lib/rets-client");

    const photoMaxTotal = Number.parseInt(process.env.MLS_SYNC_PHOTO_MAX_TOTAL ?? "800", 10);
    const photoThreshold = Number.isFinite(photoMaxTotal) ? photoMaxTotal : 800;

    let offset = 0;
    const batchSize = 2500;
    let hasMore = true;
    let listingsWithPhotos = 0;
    let retsTotalMatches: number | null = null;
    let photoPolicyLocked = false;
    let skipPhotosThisRun = false;

    const session = await createRetsSession();

    while (hasMore) {
      const result = await searchActiveListingsWithSession(session, offset, batchSize);
      if (retsTotalMatches === null) retsTotalMatches = result.count;

      const SOLD_STATUSES = new Set(["sold", "closed", "withdrawn", "expired", "cancelled", "canceled"]);
      const batchFromRets = result.records;
      if (batchFromRets.length === 0) {
        hasMore = false;
        break;
      }

      const records = batchFromRets.filter((r) => r.mls_id && !SOLD_STATUSES.has(r.status.toLowerCase()));

      totalRetsRowsPulled += batchFromRets.length;
      totalActiveSaved += records.length;

      if (!photoPolicyLocked) {
        photoPolicyLocked = true;
        skipPhotosThisRun = result.count > photoThreshold;
      }

      if (records.length > 0) {
        if (skipPhotosThisRun) {
          const ids = records.map((r) => r.mls_id);
          const byMls = new Map<string, string[]>();
          const idChunk = 400;
          for (let i = 0; i < ids.length; i += idChunk) {
            const slice = ids.slice(i, i + idChunk);
            const { data: existingRows } = await client
              .from("mls_listings")
              .select("mls_id, image_urls")
              .in("mls_id", slice);
            for (const row of existingRows ?? []) {
              const e = row as { mls_id: string; image_urls: unknown };
              byMls.set(e.mls_id, Array.isArray(e.image_urls) ? (e.image_urls as string[]) : []);
            }
          }
          for (const record of records) {
            const prev = byMls.get(record.mls_id);
            record.image_urls = prev && prev.length > 0 ? prev : [];
          }
        } else {
          for (const record of records) {
            if (!record.mls_id) continue;
            try {
              record.image_urls = await fetchPhotoUrlsWithSession(session, record.mls_id, MLS_MEDIA_MAX_URLS);
            } catch {
              record.image_urls = [];
            }
            if (record.image_urls.length > 0) listingsWithPhotos++;
          }
        }
        const { inserted, updated } = await upsertBatch(client, records, syncTimestamp);
        totalInserted += inserted;
        totalUpdated += updated;
      }

      hasMore = result.hasMore;
      offset += batchFromRets.length;

      if (offset > 1_500_000) break;
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
            total_fetched: totalRetsRowsPulled,
          })
          .eq("id", logId);
      } catch { /* ignore log failures */ }
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      updated: totalUpdated,
      deactivated,
      total_fetched: totalRetsRowsPulled,
      total_active_listings: totalActiveSaved,
      rets_total_matches: retsTotalMatches,
      photos_during_sync: skipPhotosThisRun ? "skipped_large_feed" : "fetched",
      listings_with_photos: listingsWithPhotos,
      photo_threshold: photoThreshold,
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
