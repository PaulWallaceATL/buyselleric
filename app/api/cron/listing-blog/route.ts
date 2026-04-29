import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { runListingBlogCron } from "@/lib/listing-blog";

export const maxDuration = 300;

async function isAuthorized(request: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const jar = await cookies();
  return verifyAdminSession(jar.get(ADMIN_COOKIE_NAME)?.value);
}

function parseModes(raw: unknown): ("new_listing" | "price_drop")[] {
  if (!Array.isArray(raw)) {
    return ["new_listing", "price_drop"];
  }
  return raw.filter((m): m is "new_listing" | "price_drop" => m === "new_listing" || m === "price_drop");
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runListingBlogCron({
    modes: ["new_listing", "price_drop"],
    curatedMlsIds: [],
  });

  return NextResponse.json({
    ok: result.ok,
    created: result.created,
    errors: result.errors,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const j = await request.json();
    if (j && typeof j === "object") body = j as Record<string, unknown>;
  } catch {
    body = {};
  }

  const modes: ("new_listing" | "price_drop")[] =
    "modes" in body ? parseModes(body.modes) : (["new_listing", "price_drop"] as ("new_listing" | "price_drop")[]);
  const curatedRaw = body.curated_mls_ids;
  const curated = Array.isArray(curatedRaw) ? curatedRaw.map((x) => String(x).trim()).filter(Boolean) : [];

  const result = await runListingBlogCron({
    modes,
    curatedMlsIds: curated,
  });

  return NextResponse.json({
    ok: result.ok,
    created: result.created,
    errors: result.errors,
  });
}
