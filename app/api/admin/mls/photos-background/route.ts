import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { MLS_PHOTO_ZERO_UUID } from "@/lib/mls-photo-backfill-batch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = { action?: "start" | "stop" | "reset" };

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await client.from("mls_photo_backfill_state").select("*").eq("id", 1).maybeSingle();
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: "Run supabase/mls-photo-backfill-state.sql in Supabase to create the state table.",
      },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({
      ok: true,
      state: null,
      hint: "Run supabase/mls-photo-backfill-state.sql in Supabase, then refresh.",
    });
  }

  return NextResponse.json({ ok: true, state: data });
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

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* empty */
  }
  const action = body.action;

  const { data: row, error: readErr } = await client.from("mls_photo_backfill_state").select("id").eq("id", 1).maybeSingle();
  if (readErr || !row) {
    return NextResponse.json(
      {
        ok: false,
        error: readErr?.message ?? "State row missing",
        hint: "Run supabase/mls-photo-backfill-state.sql in Supabase.",
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  if (action === "start") {
    const { error } = await client
      .from("mls_photo_backfill_state")
      .update({ enabled: true, last_error: null, last_message: "Background job enabled — Vercel Cron will run batches.", updated_at: now })
      .eq("id", 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Background photo backfill started (cron every few minutes)." });
  }

  if (action === "stop") {
    const { error } = await client
      .from("mls_photo_backfill_state")
      .update({ enabled: false, last_message: "Stopped by admin.", updated_at: now })
      .eq("id", 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Background job stopped." });
  }

  if (action === "reset") {
    const { error } = await client
      .from("mls_photo_backfill_state")
      .update({
        enabled: true,
        after_id: MLS_PHOTO_ZERO_UUID,
        rounds_completed: 0,
        listings_updated: 0,
        last_message: "Cursor reset — full pass from start.",
        last_error: null,
        updated_at: now,
      })
      .eq("id", 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "State reset and background enabled." });
  }

  return NextResponse.json({ ok: false, error: "Unknown action. Use start, stop, or reset." }, { status: 400 });
}
