import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

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
  const limit = Math.min(500, Number(searchParams.get("limit") || "50"));
  const debug = searchParams.get("debug") === "1";

  try {
    const { fetchPhotoUrls, probeMediaSearch, MLS_MEDIA_MAX_URLS } = await import("@/lib/rets-client");

    // Fetch all active listings, filter in JS to avoid RLS/filter quirks
    const { data: allListings, error: fetchError } = await client
      .from("mls_listings")
      .select("id, mls_id, image_urls")
      .eq("status", "active")
      .limit(500);

    if (fetchError) {
      return NextResponse.json({ ok: false, error: `DB fetch: ${fetchError.message}` }, { status: 500 });
    }

    const needsPhotos = (allListings ?? [])
      .filter((l) => !l.image_urls || l.image_urls.length === 0)
      .slice(0, limit);

    if (needsPhotos.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No listings need photos",
        totalListings: allListings?.length ?? 0,
        withPhotos: (allListings ?? []).filter((l) => l.image_urls && l.image_urls.length > 0).length,
        updated: 0,
      });
    }

    if (debug) {
      const sample = needsPhotos[0];
      if (!sample?.mls_id) {
        return NextResponse.json({ ok: false, error: "No sample listing for debug" }, { status: 400 });
      }
      const attempts = await probeMediaSearch(sample.mls_id, 15);
      const urls = await fetchPhotoUrls(sample.mls_id, Math.min(30, MLS_MEDIA_MAX_URLS));
      return NextResponse.json({
        ok: true,
        debug: true,
        sampleMlsId: sample.mls_id,
        resolvedUrls: urls,
        attempts,
        hint: "If all replyCode≠0 or recordCount=0, open /api/admin/mls/metadata?type=table&resource=Media&class=Media and match the link field to ListingId.",
      });
    }

    let updated = 0;
    let errors = 0;
    let fetchedZero = 0;
    const errorSamples: string[] = [];
    const batchSize = 10;

    for (let i = 0; i < needsPhotos.length; i += batchSize) {
      const batch = needsPhotos.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (l) => {
          try {
            const urls = await fetchPhotoUrls(l.mls_id, MLS_MEDIA_MAX_URLS);
            return { id: l.id, mls_id: l.mls_id, urls, error: null };
          } catch (err) {
            return {
              id: l.id,
              mls_id: l.mls_id,
              urls: [],
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      );

      for (const r of results) {
        if (r.error) {
          errors++;
          if (errorSamples.length < 3) errorSamples.push(`${r.mls_id}: ${r.error}`);
          continue;
        }
        if (r.urls.length === 0) {
          fetchedZero++;
          continue;
        }
        const { error } = await client
          .from("mls_listings")
          .update({ image_urls: r.urls })
          .eq("id", r.id);
        if (error) {
          errors++;
          if (errorSamples.length < 3) errorSamples.push(`${r.mls_id} update: ${error.message}`);
        } else {
          updated++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      totalListings: allListings?.length ?? 0,
      checked: needsPhotos.length,
      updated,
      fetchedZero,
      errors,
      errorSamples,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
