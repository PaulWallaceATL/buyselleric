import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/listing-search-suggest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const suggestions = await getSearchSuggestions(q);
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=45, stale-while-revalidate=120",
        },
      },
    );
  } catch {
    return NextResponse.json({ suggestions: [] as unknown[] }, { status: 200 });
  }
}
