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
  const limit = Math.min(500, Number(searchParams.get("limit") || "200"));

  try {
    const { fetchPhotoUrls } = await import("@/lib/rets-client");

    const { data: listings } = await client
      .from("mls_listings")
      .select("id, mls_id, image_urls")
      .eq("status", "active")
      .or("image_urls.is.null,image_urls.eq.{}")
      .limit(limit);

    if (!listings || listings.length === 0) {
      return NextResponse.json({ ok: true, message: "No listings need photos", updated: 0 });
    }

    let updated = 0;
    let errors = 0;
    const batchSize = 20;

    for (let i = 0; i < listings.length; i += batchSize) {
      const batch = listings.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (l) => {
          try {
            const urls = await fetchPhotoUrls(l.mls_id, 10);
            return { id: l.id, urls };
          } catch {
            return { id: l.id, urls: [] };
          }
        }),
      );

      for (const r of results) {
        if (r.urls.length > 0) {
          const { error } = await client
            .from("mls_listings")
            .update({ image_urls: r.urls })
            .eq("id", r.id);
          if (error) errors++;
          else updated++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: listings.length,
      updated,
      errors,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
