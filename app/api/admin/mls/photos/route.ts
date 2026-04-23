import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MLS_PHOTO_DEFAULT_BATCH,
  MLS_PHOTO_MAX_BATCH,
  parseMlsPhotoAfterUuid,
  runMlsPhotoBackfillBatch,
} from "@/lib/mls-photo-backfill-batch";

/** Photo batches call RETS per listing; keep under Vercel ceiling. */
export const maxDuration = 300;

type PhotoBody = {
  after_id?: string;
  batch_size?: number;
  debug?: boolean;
};

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

  const afterId = parseMlsPhotoAfterUuid(
    typeof body.after_id === "string" ? body.after_id : searchParams.get("after_id") ?? undefined,
  );

  const rawSize = Number(body.batch_size ?? searchParams.get("batch_size") ?? MLS_PHOTO_DEFAULT_BATCH);
  const processLimit = Math.min(
    MLS_PHOTO_MAX_BATCH,
    Math.max(5, Number.isFinite(rawSize) ? rawSize : MLS_PHOTO_DEFAULT_BATCH),
  );

  try {
    const { probeMediaSearch, fetchPhotoUrls, MLS_MEDIA_MAX_URLS } = await import("@/lib/rets-client");

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

    const result = await runMlsPhotoBackfillBatch(client, { afterId, processLimit });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, hint: result.hint }, { status: 500 });
    }
    return NextResponse.json(result);
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
