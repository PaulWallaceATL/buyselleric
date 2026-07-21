import { NextResponse } from "next/server";
import { warmMlsListingCache } from "@/lib/listings-queries";

export const dynamic = "force-dynamic";

/** Prefetch/warm Supabase cache for an MLS detail deep link (search suggestions). */
export async function POST(request: Request) {
  let id = "";
  try {
    const body = (await request.json()) as { id?: string };
    id = typeof body.id === "string" ? body.id.trim() : "";
  } catch {
    id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  }
  if (!id || id.length > 64 || !/^[\w.-]+$/.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const ok = await warmMlsListingCache(id);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
