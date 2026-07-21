import { NextResponse } from "next/server";
import {
  dreamIntentToSearchParams,
  parseDreamHomeIntent,
} from "@/lib/dream-home-intent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MIN_LEN = 8;
const MAX_LEN = 500;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "Dream search is not configured yet." },
      { status: 503 },
    );
  }

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
    const intent = await parseDreamHomeIntent(trimmed);
    const hasHard =
      !!intent.filters.q ||
      intent.filters.minPrice != null ||
      intent.filters.maxPrice != null ||
      intent.filters.minBeds != null ||
      intent.filters.minBaths != null ||
      intent.filters.minSqft != null ||
      intent.filters.maxSqft != null ||
      !!intent.filters.propertyType;

    if (!hasHard && intent.softPrefs.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "We couldn't pull searchable filters from that. Try adding a city, budget, or bedroom count.",
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
