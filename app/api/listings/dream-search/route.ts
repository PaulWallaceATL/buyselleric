import { NextResponse } from "next/server";
import {
  dreamIntentToSearchParams,
  parseDreamHomeIntent,
  parseDreamHomeIntentHeuristicOnly,
  refineDreamHomeIntent,
} from "@/lib/dream-home-intent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MIN_LEN = 8;
const MAX_LEN = 500;

function intentHasSignal(intent: {
  filters: {
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    propertyType?: string;
  };
  softPrefs: string[];
  amenities?: {
    hasPool?: boolean;
    minGarageSpaces?: number;
    hasFireplace?: boolean;
    hasWaterfront?: boolean;
    minYearBuilt?: number;
    maxYearBuilt?: number;
    maxStories?: number;
    minAcres?: number;
    noHoa?: boolean;
  };
}): boolean {
  const f = intent.filters;
  const a = intent.amenities ?? {};
  return !!(
    f.q ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.minBeds != null ||
    f.minBaths != null ||
    f.minSqft != null ||
    f.maxSqft != null ||
    f.propertyType ||
    intent.softPrefs.length > 0 ||
    a.hasPool ||
    (a.minGarageSpaces != null && a.minGarageSpaces > 0) ||
    a.hasFireplace ||
    a.hasWaterfront ||
    a.minYearBuilt != null ||
    a.maxYearBuilt != null ||
    a.maxStories != null ||
    a.minAcres != null ||
    a.noHoa
  );
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    else if (typeof v === "boolean") out[k] = v ? "1" : "0";
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const prompt =
    typeof body === "object" && body && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "")
      : "";
  const trimmed = prompt.trim();
  const current = asStringRecord(
    typeof body === "object" && body && "current" in body
      ? (body as { current?: unknown }).current
      : undefined,
  );
  const isRefine = Boolean(current && Object.keys(current).length > 0);

  if (trimmed.length < MIN_LEN) {
    return NextResponse.json(
      { ok: false, message: `Please describe your dream home in at least ${MIN_LEN} characters.` },
      { status: 400 },
    );
  }
  if (trimmed.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, message: `Keep your description under ${MAX_LEN} characters.` },
      { status: 400 },
    );
  }

  try {
    let intent;
    if (isRefine && current) {
      intent = await refineDreamHomeIntent(trimmed, current);
    } else if (process.env.OPENAI_API_KEY) {
      try {
        intent = await parseDreamHomeIntent(trimmed);
      } catch (err) {
        console.warn("[dream-search] OpenAI failed, using heuristics", err);
        intent = parseDreamHomeIntentHeuristicOnly(trimmed);
      }
    } else {
      intent = parseDreamHomeIntentHeuristicOnly(trimmed);
    }

    if (!intentHasSignal(intent)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "We couldn't pull searchable filters from that. Try adding a city, budget, bedrooms, or amenities like pool/garage.",
        },
        { status: 422 },
      );
    }

    const priorDream = current?.dream?.trim();
    const dreamText = isRefine
      ? [priorDream, trimmed].filter(Boolean).join(" · ").slice(0, 500)
      : trimmed;

    const view = current?.view;
    const params = dreamIntentToSearchParams(intent, {
      dreamText,
      ...(view && view !== "list" ? { view } : {}),
    });
    // Preserve map polygon across refine turns.
    if (current?.mapPoly) params.set("mapPoly", current.mapPoly);
    const qs = params.toString();

    return NextResponse.json({
      ok: true,
      intent,
      refined: isRefine,
      href: qs ? `/listings?${qs}` : "/listings",
    });
  } catch (err) {
    console.error("[dream-search]", err);
    return NextResponse.json(
      { ok: false, message: "Could not understand that description. Please try again." },
      { status: 502 },
    );
  }
}
