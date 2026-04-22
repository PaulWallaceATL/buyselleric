import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const mlsId = searchParams.get("id") || "10624657";

  const { data } = await client
    .from("mls_listings")
    .select("mls_id, raw_data")
    .eq("mls_id", mlsId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = (data.raw_data ?? {}) as Record<string, unknown>;
  const allKeys = Object.keys(raw).sort();
  const photoRelated: Record<string, unknown> = {};
  for (const k of allKeys) {
    const lower = k.toLowerCase();
    if (
      lower.includes("photo") ||
      lower.includes("image") ||
      lower.includes("media") ||
      lower.includes("url") ||
      lower.includes("uri") ||
      lower.includes("vtour") ||
      lower.includes("virtual")
    ) {
      photoRelated[k] = raw[k];
    }
  }

  return NextResponse.json({
    ok: true,
    mls_id: data.mls_id,
    totalFields: allKeys.length,
    allFieldNames: allKeys,
    photoRelatedFields: photoRelated,
  });
}
