import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MlsListingData } from "@/lib/rets-client";
import { insertPriceDropEventsForBatch } from "@/lib/mls-price-events";

export const maxDuration = 300;

const DEFAULT_BATCH = 400;
const MIN_BATCH = 100;
const MAX_BATCH = 2500;

type SyncRequestBody = {
  offset?: number;
  sync_timestamp?: string;
  batch_size?: number;
};

function parseSyncBody(searchParams: URLSearchParams): Partial<SyncRequestBody> {
  const o = searchParams.get("offset");
  const b = searchParams.get("batch_size");
  const t = searchParams.get("sync_timestamp");
  const out: Partial<SyncRequestBody> = {};
  if (o != null && o !== "") out.offset = Number(o);
  if (b != null && b !== "") out.batch_size = Number(b);
  if (t != null && t !== "") out.sync_timestamp = t;
  return out;
}

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

    const { searchParams } = new URL(request.url);
    let body: Partial<SyncRequestBody> = parseSyncBody(searchParams);
    try {
      const json = (await request.json()) as Partial<SyncRequestBody>;
      body = {
        ...body,
        ...(json.offset !== undefined ? { offset: json.offset } : {}),
        ...(json.sync_timestamp !== undefined ? { sync_timestamp: json.sync_timestamp } : {}),
        ...(json.batch_size !== undefined ? { batch_size: json.batch_size } : {}),
      };
    } catch {
      /* empty body — use query / defaults */
    }

    const offset = Number.isFinite(body.offset) && (body.offset as number) >= 0 ? (body.offset as number) : 0;
    const batchSize = Math.min(
      MAX_BATCH,
      Math.max(MIN_BATCH, Number.isFinite(body.batch_size) ? (body.batch_size as number) : DEFAULT_BATCH),
    );
    const syncTimestamp =
      typeof body.sync_timestamp === "string" && body.sync_timestamp.length > 10
        ? body.sync_timestamp
        : new Date().toISOString();

    const {
      createRetsSession,
      searchActiveListingsWithSession,
      fetchPhotoUrlsWithSession,
      MLS_MEDIA_MAX_URLS,
    } = await import("@/lib/rets-client");

    const photoMaxTotal = Number.parseInt(process.env.MLS_SYNC_PHOTO_MAX_TOTAL ?? "800", 10);
    const photoThreshold = Number.isFinite(photoMaxTotal) ? photoMaxTotal : 800;

    const session = await createRetsSession();
    const result = await searchActiveListingsWithSession(session, offset, batchSize);
    const retsTotalMatches = result.count;

    const SOLD_STATUSES = new Set(["sold", "closed", "withdrawn", "expired", "cancelled", "canceled"]);
    const batchFromRets = result.records;

    if (batchFromRets.length === 0) {
      const done = !result.hasMore;
      let deactivated = 0;
      if (done && offset > 0) {
        try {
          const deactivateResult = await client
            .from("mls_listings")
            .update({ status: "inactive" })
            .lt("synced_at", syncTimestamp)
            .eq("status", "active")
            .select("id");
          deactivated = deactivateResult.data?.length ?? 0;
        } catch {
          /* ignore */
        }
        try {
          await client.from("mls_sync_log").insert({
            status: "completed",
            finished_at: new Date().toISOString(),
            inserted: 0,
            updated: 0,
            deactivated,
            total_fetched: offset,
          });
        } catch {
          /* ignore log */
        }
      }

      return NextResponse.json({
        ok: true,
        done,
        next_offset: offset,
        sync_timestamp: syncTimestamp,
        batch_rets_rows: 0,
        inserted: 0,
        updated: 0,
        deactivated,
        rets_total_matches: retsTotalMatches,
        photos_during_sync: "none",
        listings_with_photos: 0,
        photo_threshold: photoThreshold,
        message:
          offset === 0
            ? "No listings returned for this query (offset 0)."
            : "No rows in this page; treating as end of feed.",
      });
    }

    const records = batchFromRets.filter((r) => r.mls_id && !SOLD_STATUSES.has(r.status.toLowerCase()));
    const skipPhotosThisRun = retsTotalMatches > photoThreshold;

    let listingsWithPhotos = 0;
    if (records.length > 0) {
      if (skipPhotosThisRun) {
        const ids = records.map((r) => r.mls_id);
        const byMls = new Map<string, string[]>();
          const idChunk = 250;
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
    }

    const { inserted, updated } =
      records.length > 0 ? await upsertBatch(client, records, syncTimestamp) : { inserted: 0, updated: 0 };

    const nextOffset = offset + batchFromRets.length;
    const done = !result.hasMore;

    let deactivated = 0;
    if (done) {
      try {
        const deactivateResult = await client
          .from("mls_listings")
          .update({ status: "inactive" })
          .lt("synced_at", syncTimestamp)
          .eq("status", "active")
          .select("id");
        deactivated = deactivateResult.data?.length ?? 0;
      } catch {
        /* ignore */
      }

      try {
        await client.from("mls_sync_log").insert({
          status: "completed",
          finished_at: new Date().toISOString(),
          inserted,
          updated,
          deactivated,
          total_fetched: nextOffset,
        });
      } catch {
        /* ignore log */
      }
    }

    return NextResponse.json({
      ok: true,
      done,
      next_offset: nextOffset,
      sync_timestamp: syncTimestamp,
      batch_rets_rows: batchFromRets.length,
      batch_active_rows: records.length,
      inserted,
      updated,
      deactivated,
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
    await insertPriceDropEventsForBatch(client, chunk);

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
