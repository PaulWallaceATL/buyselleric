import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const slug = typeof body === "object" && body !== null && "slug" in body
    ? String((body as { slug: unknown }).slug)
    : "";

  if (!slug) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  await supabase.rpc("increment_blog_view", { post_slug: slug });

  return NextResponse.json({ ok: true });
}
