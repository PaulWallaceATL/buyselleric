import { NextResponse } from "next/server";
import {
  MLS_PHOTO_MAX_BATCH,
  MLS_PHOTO_ZERO_UUID,
  parseMlsPhotoAfterUuid,
  runMlsPhotoBackfillBatch,
} from "@/lib/mls-photo-backfill-batch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { data: state, error: stErr } = await client.from("mls_photo_backfill_state").select("*").eq("id", 1).maybeSingle();

  if (stErr) {
    return NextResponse.json(
      { ok: false, error: stErr.message, hint: "Run supabase/mls-photo-backfill-state.sql" },
      { status: 500 },
    );
  }
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "mls_photo_backfill_state missing", hint: "Run supabase/mls-photo-backfill-state.sql" },
      { status: 500 },
    );
  }

  if (!state.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "background_disabled" });
  }

  const rawBatch = Number.parseInt(process.env.MLS_PHOTO_CRON_BATCH_SIZE ?? "22", 10);
  const batchSize = Math.min(MLS_PHOTO_MAX_BATCH, Math.max(5, Number.isFinite(rawBatch) ? rawBatch : 22));
  const afterId = parseMlsPhotoAfterUuid(String(state.after_id ?? MLS_PHOTO_ZERO_UUID));

  const result = await runMlsPhotoBackfillBatch(client, { afterId, processLimit: batchSize });

  const now = new Date().toISOString();

  if (!result.ok) {
    await client
      .from("mls_photo_backfill_state")
      .update({
        enabled: false,
        last_error: result.error,
        last_message: "Cron batch failed — disabled.",
        updated_at: now,
      })
      .eq("id", 1);
    return NextResponse.json({ ok: false, error: result.error, hint: result.hint }, { status: 500 });
  }

  const prevRounds = Number(state.rounds_completed ?? 0);
  const prevUpdated = Number(state.listings_updated ?? 0);
  const done = result.done;

  await client
    .from("mls_photo_backfill_state")
    .update({
      after_id: result.after_id,
      rounds_completed: prevRounds + 1,
      listings_updated: prevUpdated + result.updated,
      last_message: `Cron round ${prevRounds + 1}: checked ${result.checked}, updated ${result.updated}, done=${String(done)}${result.message ? ` · ${result.message}` : ""}`,
      last_error: null,
      enabled: !done,
      updated_at: now,
    })
    .eq("id", 1);

  return NextResponse.json({
    ok: true,
    skipped: false,
    batch: result,
    background_still_active: !done,
  });
}
