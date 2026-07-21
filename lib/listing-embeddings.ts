/**
 * Listing text embeddings for dream-home hybrid ranking (Phase 3).
 * Model: OpenAI text-embedding-3-small (1536 dims). Same OPENAI_API_KEY as blogs/intent.
 */

import { createHash } from "crypto";
import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const LISTING_EMBEDDING_MODEL = "text-embedding-3-small";
export const LISTING_EMBEDDING_DIMS = 1536;

const EMBED_BATCH = 50;
const LIVE_EMBED_CAP = 24;

let _client: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new OpenAI({ apiKey });
  return _client;
}

export type ListingEmbedSource = {
  mls_id: string;
  title?: string | null;
  description?: string | null;
  property_type?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

/** Build the text we embed — remarks/description first, then structured location. */
export function buildListingEmbedText(row: ListingEmbedSource): string {
  const parts = [
    row.title,
    row.description,
    row.property_type,
    [row.address_line, row.city, row.state, row.postal_code].filter(Boolean).join(", "),
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return parts.join("\n").slice(0, 8000);
}

export function hashEmbedText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Soft prefs → short query string for embedding. */
export function buildSoftPrefQueryText(softPrefs: string[]): string {
  return softPrefs
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.embeddings.create({
    model: LISTING_EMBEDDING_MODEL,
    input: texts.map((t) => (t.trim() ? t.slice(0, 8000) : " ")),
  });

  const byIndex = new Map(response.data.map((d) => [d.index, d.embedding]));
  return texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb || emb.length !== LISTING_EMBEDDING_DIMS) {
      throw new Error(`Missing or invalid embedding at index ${i}`);
    }
    return emb;
  });
}

export async function embedQueryText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!getOpenAIClient()) return null;
  try {
    const [emb] = await embedTexts([trimmed]);
    return emb ?? null;
  } catch (err) {
    console.warn("[listing-embeddings] query embed failed", err);
    return null;
  }
}

/** Cosine similarity for two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}

type StoredEmbedRow = {
  mls_id: string;
  embed_text_hash: string | null;
};

/**
 * Embed and upsert vectors for rows whose embed text hash changed (or missing).
 * Safe to call from sync — skips when OpenAI/Supabase unavailable.
 */
export async function upsertListingEmbeddings(
  rows: ListingEmbedSource[],
  options?: { force?: boolean },
): Promise<{ updated: number; skipped: number }> {
  const client = createSupabaseAdminClient();
  if (!client || !getOpenAIClient() || rows.length === 0) {
    return { updated: 0, skipped: rows.length };
  }

  const withText = rows
    .map((r) => {
      const text = buildListingEmbedText(r);
      const hash = hashEmbedText(text);
      return { ...r, text, hash };
    })
    .filter((r) => r.mls_id && r.text.trim().length > 20);

  if (withText.length === 0) return { updated: 0, skipped: rows.length };

  const mlsIds = withText.map((r) => r.mls_id);
  const existingByMls = new Map<string, string | null>();
  if (!options?.force) {
    const { data } = await client
      .from("mls_listings")
      .select("mls_id, embed_text_hash")
      .in("mls_id", mlsIds);
    for (const row of (data ?? []) as StoredEmbedRow[]) {
      existingByMls.set(row.mls_id, row.embed_text_hash);
    }
  }

  const needs = withText.filter(
    (r) => options?.force || existingByMls.get(r.mls_id) !== r.hash,
  );

  let updated = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < needs.length; i += EMBED_BATCH) {
    const chunk = needs.slice(i, i + EMBED_BATCH);
    try {
      const embeddings = await embedTexts(chunk.map((c) => c.text));
      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j]!;
        const embedding = embeddings[j]!;
        const { error } = await client
          .from("mls_listings")
          .update({
            embedding: JSON.stringify(embedding),
            embedding_model: LISTING_EMBEDDING_MODEL,
            embedding_updated_at: now,
            embed_text_hash: row.hash,
            updated_at: now,
          })
          .eq("mls_id", row.mls_id);
        if (error) {
          console.warn("[listing-embeddings] update failed", row.mls_id, error.message);
          continue;
        }
        updated++;
      }
    } catch (err) {
      console.warn("[listing-embeddings] batch failed", err);
      break;
    }
  }

  return { updated, skipped: rows.length - updated };
}

/** Backfill active rows missing embeddings. Returns how many were written. */
export async function backfillMissingListingEmbeddings(
  limit = 40,
): Promise<{ fetched: number; updated: number; done: boolean }> {
  const client = createSupabaseAdminClient();
  if (!client || !getOpenAIClient()) {
    return { fetched: 0, updated: 0, done: true };
  }

  const { data, error } = await client
    .from("mls_listings")
    .select(
      "mls_id, title, description, property_type, address_line, city, state, postal_code",
    )
    .eq("status", "active")
    .is("embedding", null)
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[listing-embeddings] backfill select", error.message);
    return { fetched: 0, updated: 0, done: true };
  }

  const rows = (data ?? []) as ListingEmbedSource[];
  if (rows.length === 0) return { fetched: 0, updated: 0, done: true };

  const { updated } = await upsertListingEmbeddings(rows, { force: true });
  return { fetched: rows.length, updated, done: rows.length < limit };
}

/**
 * Fetch stored cosine similarities for candidate MLS ids vs a query embedding.
 * Falls back to empty map if RPC / columns are missing.
 */
export async function fetchCandidateEmbeddingSimilarities(
  queryEmbedding: number[],
  candidateMlsIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (candidateMlsIds.length === 0) return map;

  const client = createSupabaseAdminClient();
  if (!client) return map;

  try {
    const { data, error } = await client.rpc("match_listing_embeddings", {
      query_embedding: JSON.stringify(queryEmbedding),
      candidate_mls_ids: candidateMlsIds,
      match_count: Math.min(200, candidateMlsIds.length),
    });
    if (error) {
      console.warn("[listing-embeddings] match rpc", error.message);
      return map;
    }
    for (const row of data ?? []) {
      const r = row as { mls_id?: string; similarity?: number };
      if (r.mls_id && typeof r.similarity === "number" && Number.isFinite(r.similarity)) {
        map.set(r.mls_id, r.similarity);
      }
    }
  } catch (err) {
    console.warn("[listing-embeddings] match rpc threw", err);
  }

  return map;
}

/**
 * Live-embed match texts for candidates missing stored vectors (capped).
 * Returns mls_id / listing id → cosine similarity to the query embedding.
 */
export async function liveEmbedCandidateSimilarities(
  queryEmbedding: number[],
  items: { key: string; text: string }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!getOpenAIClient() || items.length === 0) return map;

  const capped = items
    .map((i) => ({ key: i.key, text: i.text.trim().slice(0, 4000) }))
    .filter((i) => i.text.length > 20)
    .slice(0, LIVE_EMBED_CAP);

  if (capped.length === 0) return map;

  try {
    const embeddings = await embedTexts(capped.map((c) => c.text));
    for (let i = 0; i < capped.length; i++) {
      map.set(capped[i]!.key, cosineSimilarity(queryEmbedding, embeddings[i]!));
    }
  } catch (err) {
    console.warn("[listing-embeddings] live embed failed", err);
  }

  return map;
}
