import { NextResponse } from "next/server";
import {
  dreamIntentToSearchParams,
  parseDreamHomeIntent,
  parseDreamHomeIntentHeuristicOnly,
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
    if (process.env.OPENAI_API_KEY) {
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

    const params = dreamIntentToSearchParams(intent, { dreamText: trimmed });
    const qs = params.toString();

    return NextResponse.json({
      ok: true,
      intent,
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
