import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { runSeoAgentHeartbeat } from "@/lib/seo-agent/run-heartbeat";

export const maxDuration = 600;

async function isAuthorized(request: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const jar = await cookies();
  return verifyAdminSession(jar.get(ADMIN_COOKIE_NAME)?.value);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSeoAgentHeartbeat();
  return NextResponse.json({
    ok: result.ok,
    run_id: result.run_id,
    skipped: result.skipped,
    errors: result.errors,
    created_seo_slugs: result.created_seo_slugs,
    created_listing: result.created_listing,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSeoAgentHeartbeat();
  return NextResponse.json({
    ok: result.ok,
    run_id: result.run_id,
    skipped: result.skipped,
    errors: result.errors,
    created_seo_slugs: result.created_seo_slugs,
    created_listing: result.created_listing,
  });
}
