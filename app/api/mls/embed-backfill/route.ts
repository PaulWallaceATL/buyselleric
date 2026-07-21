import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { backfillMissingListingEmbeddings } from "@/lib/listing-embeddings";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Backfill mls_listings.embedding for active rows missing vectors.
 * Auth: admin cookie or Authorization: Bearer CRON_SECRET
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const jar = await cookies();
  const adminToken = jar.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = verifyAdminSession(adminToken);
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isAdmin && !isCron) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  let limit = Number(searchParams.get("limit") ?? "40");
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
  } catch {
    /* empty body ok */
  }
  limit = Math.min(100, Math.max(1, Math.floor(limit)));

  try {
    const result = await backfillMissingListingEmbeddings(limit);
    return NextResponse.json({
      ok: true,
      ...result,
      hint: result.done
        ? "All active listings with missing embeddings are done (or none left)."
        : "Call again until done=true. Apply supabase/mls-listings-embeddings.sql first if updates fail.",
    });
  } catch (err) {
    console.error("[embed-backfill]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Backfill failed",
        hint: "Ensure supabase/mls-listings-embeddings.sql was applied.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
