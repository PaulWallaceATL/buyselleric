import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { MLS_NO_PHOTOS_SENTINEL } from "@/lib/listing-urls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Photo batches call RETS per listing; keep under Vercel ceiling. */
export const maxDuration = 300;

type PhotoBody = {
  after_id?: string;
  batch_size?: number;
  debug?: boolean;
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PROCESS = 28;
const MAX_PROCESS = 55;

function parseAfterUuid(raw: string | undefined): string {
  if (!raw || raw === ZERO_UUID) return ZERO_UUID;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(raw) ? raw : ZERO_UUID;
}

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  let body: PhotoBody = {};
  try {
    body = (await request.json()) as PhotoBody;
  } catch {
    /* query only */
  }

  const debug =
    searchParams.get("debug") === "1" ||
    body.debug === true ||
    searchParams.get("debug") === "true";

  const afterId = parseAfterUuid(
    typeof body.after_id === "string" ? body.after_id : searchParams.get("after_id") ?? undefined,
  );

  const rawSize = Number(body.batch_size ?? searchParams.get("batch_size") ?? DEFAULT_PROCESS);
  const processLimit = Math.min(MAX_PROCESS, Math.max(5, Number.isFinite(rawSize) ? rawSize : DEFAULT_PROCESS));

  try {
    const { fetchPhotoUrlsWithSession, createRetsSession, probeMediaSearch, fetchPhotoUrls, MLS_MEDIA_MAX_URLS } =
      await import("@/lib/rets-client");

    if (debug) {
      let sid: string | undefined;
      const { data: rpcOne, error: rpcErr } = await client.rpc("mls_listings_missing_photos_batch", {
        p_limit: 1,
        p_after_id: afterId,
      });
      if (!rpcErr && rpcOne?.[0]) {
        sid = (rpcOne[0] as { mls_id: string }).mls_id;
      } else {
        const { data: fb } = await client
          .from("mls_listings")
          .select("mls_id, image_urls")
          .eq("status", "active")
          .order("id", { ascending: true })
          .limit(80);
        const row = (fb ?? []).find((r) => {
          const u = (r as { image_urls?: string[] | null }).image_urls;
          return !u || u.length === 0;
        }) as { mls_id: string } | undefined;
        sid = row?.mls_id;
      }
      if (!sid) {
        return NextResponse.json({
          ok: false,
          error:
            rpcErr?.message ??
            "No sample listing without photos. Run supabase/mls-listings-missing-photos-rpc.sql if RPC is missing.",
        }, { status: 400 });
      }
      const attempts = await probeMediaSearch(sid, 15);
      const urls = await fetchPhotoUrls(sid, Math.min(30, MLS_MEDIA_MAX_URLS));
      return NextResponse.json({
        ok: true,
        debug: true,
        sampleMlsId: sid,
        resolvedUrls: urls,
        attempts,
      });
    }

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
        return NextResponse.json({
          ok: true,
          done: true,
          after_id: afterId,
          checked: 0,
          updated: 0,
          fetchedZero: 0,
          errors: 0,
          errorSamples: [] as string[],
          used_rpc: true,
          message: "No listings missing photos (RPC).",
        });
      }
    } else {
      let scan = client
        .from("mls_listings")
        .select("id, mls_id, image_urls")
        .eq("status", "active")
        .order("id", { ascending: true })
        .limit(600);
      if (afterId !== ZERO_UUID) scan = scan.gt("id", afterId);
      const { data: scanRows, error: scanErr } = await scan;

      if (scanErr) {
        return NextResponse.json(
          {
            ok: false,
            error: rpcError?.message ?? scanErr.message,
            hint: "Run supabase/mls-listings-missing-photos-rpc.sql in Supabase for reliable paging.",
          },
          { status: 500 },
        );
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
        return NextResponse.json({
          ok: true,
          done: !advanced,
          after_id: lastRow?.id ?? afterId,
          checked: 0,
          updated: 0,
          fetchedZero: 0,
          errors: 0,
          errorSamples: [] as string[],
          used_rpc: usedRpc,
          message: advanced
            ? "No empty-image rows in this window; cursor advanced by id."
            : "No listings missing photos.",
        });
      }

      rows = filtered;
    }

    if (rows.length === 0) {
      return NextResponse.json({
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
      });
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
    // RPC returns the next N truly-missing rows; a short batch means the queue is exhausted.
    // Fallback scans only 600 ids per request — a short batch usually means "sparse empties in
    // this window", not end of DB; never set done from row count alone (was stopping after ~1–2 rounds).
    const done = usedRpc && rows.length < processLimit;

    return NextResponse.json({
      ok: true,
      done,
      after_id: lastId,
      checked: rows.length,
      updated,
      fetchedZero,
      errors,
      errorSamples,
      used_rpc: usedRpc,
      hint: usedRpc ? undefined : "Using id-window scan (RPC missing?). Run supabase/mls-listings-missing-photos-rpc.sql for faster, reliable paging.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
