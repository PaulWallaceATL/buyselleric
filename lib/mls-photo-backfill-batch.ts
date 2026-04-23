import type { SupabaseClient } from "@supabase/supabase-js";
import { MLS_NO_PHOTOS_SENTINEL } from "@/lib/listing-urls";

export const MLS_PHOTO_ZERO_UUID = "00000000-0000-0000-0000-000000000000";
export const MLS_PHOTO_DEFAULT_BATCH = 28;
export const MLS_PHOTO_MAX_BATCH = 55;

export type MlsPhotoBatchSuccess = {
  ok: true;
  done: boolean;
  after_id: string;
  checked: number;
  updated: number;
  fetchedZero: number;
  errors: number;
  errorSamples: string[];
  used_rpc: boolean;
  hint?: string;
  message?: string;
};

export type MlsPhotoBatchResult = MlsPhotoBatchSuccess | { ok: false; error: string; hint?: string };

export function parseMlsPhotoAfterUuid(raw: string | undefined): string {
  if (!raw || raw === MLS_PHOTO_ZERO_UUID) return MLS_PHOTO_ZERO_UUID;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(raw) ? raw : MLS_PHOTO_ZERO_UUID;
}

export async function runMlsPhotoBackfillBatch(
  client: SupabaseClient,
  options: { afterId: string; processLimit: number },
): Promise<MlsPhotoBatchResult> {
  const { afterId, processLimit } = options;
  const { fetchPhotoUrlsWithSession, createRetsSession, MLS_MEDIA_MAX_URLS } = await import("@/lib/rets-client");

  const { data: rpcRows, error: rpcError } = await client.rpc("mls_listings_missing_photos_batch", {
    p_limit: processLimit,
    p_after_id: afterId,
  });

  let rows: { id: string; mls_id: string }[] = [];
  let usedRpc = false;

  if (!rpcError && Array.isArray(rpcRows)) {
    if (rpcRows.length > 0) {
      rows = rpcRows as { id: string; mls_id: string }[];
      usedRpc = true;
    } else {
      return {
        ok: true,
        done: true,
        after_id: afterId,
        checked: 0,
        updated: 0,
        fetchedZero: 0,
        errors: 0,
        errorSamples: [],
        used_rpc: true,
        message: "No listings missing photos (RPC).",
      };
    }
  } else {
    let scan = client
      .from("mls_listings")
      .select("id, mls_id, image_urls")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(600);
    if (afterId !== MLS_PHOTO_ZERO_UUID) scan = scan.gt("id", afterId);
    const { data: scanRows, error: scanErr } = await scan;

    if (scanErr) {
      return {
        ok: false,
        error: rpcError?.message ?? scanErr.message,
        hint: "Run supabase/mls-listings-missing-photos-rpc.sql in Supabase for reliable paging.",
      };
    }

    const filtered = (scanRows ?? [])
      .filter((r) => {
        const u = (r as { image_urls?: string[] | null }).image_urls;
        return !u || u.length === 0;
      })
      .map((r) => ({ id: (r as { id: string }).id, mls_id: (r as { mls_id: string }).mls_id }))
      .slice(0, processLimit);

    if (filtered.length === 0) {
      const scanned = scanRows ?? [];
      const advanced = scanned.length >= 600;
      const lastRow = advanced ? (scanned[scanned.length - 1] as { id: string }) : null;
      return {
        ok: true,
        done: !advanced,
        after_id: lastRow?.id ?? afterId,
        checked: 0,
        updated: 0,
        fetchedZero: 0,
        errors: 0,
        errorSamples: [],
        used_rpc: usedRpc,
        message: advanced
          ? "No empty-image rows in this window; cursor advanced by id."
          : "No listings missing photos.",
      };
    }

    rows = filtered;
  }

  if (rows.length === 0) {
    return {
      ok: true,
      done: true,
      after_id: afterId,
      checked: 0,
      updated: 0,
      fetchedZero: 0,
      errors: 0,
      errorSamples: [],
      used_rpc: usedRpc,
      message: "No listings missing photos in this page.",
    };
  }

  const session = await createRetsSession();
  let updated = 0;
  let fetchedZero = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (const row of rows) {
    try {
      const urls = await fetchPhotoUrlsWithSession(session, row.mls_id, MLS_MEDIA_MAX_URLS);
      if (urls.length === 0) {
        fetchedZero++;
        const { error: markErr } = await client
          .from("mls_listings")
          .update({ image_urls: [MLS_NO_PHOTOS_SENTINEL] })
          .eq("id", row.id);
        if (markErr) {
          errors++;
          if (errorSamples.length < 4) {
            errorSamples.push(`${row.mls_id}: sentinel update: ${markErr.message}`);
          }
        } else {
          updated++;
        }
        continue;
      }
      const { error } = await client.from("mls_listings").update({ image_urls: urls }).eq("id", row.id);
      if (error) {
        errors++;
        if (errorSamples.length < 4) errorSamples.push(`${row.mls_id}: ${error.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      errors++;
      if (errorSamples.length < 4) {
        errorSamples.push(`${row.mls_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const lastId = rows[rows.length - 1]!.id;
  const done = usedRpc && rows.length < processLimit;

  const base: MlsPhotoBatchSuccess = {
    ok: true,
    done,
    after_id: lastId,
    checked: rows.length,
    updated,
    fetchedZero,
    errors,
    errorSamples,
    used_rpc: usedRpc,
  };
  if (!usedRpc) {
    base.hint =
      "Using id-window scan (RPC missing?). Run supabase/mls-listings-missing-photos-rpc.sql for faster, reliable paging.";
  }
  return base;
}
