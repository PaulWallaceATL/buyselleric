import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Phase 0 compliance probe: RETS Property → Agent → Office + Bridge enrich for one MLS id.
 * GET /api/admin/mls/attribution?id=10668028
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!verifyAdminSession(token) && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() || "10668028";
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id must be numeric MLS ListingId" }, { status: 400 });
  }

  try {
    const { isRetsConfigured, probeRetsAttributionForMlsId } = await import("@/lib/rets-client");
    const retsConfigured = isRetsConfigured();
    const rets = retsConfigured ? await probeRetsAttributionForMlsId(id) : null;

    let bridge: {
      configured: boolean;
      listing_agent?: string;
      listing_office?: string;
      listing_agent_phone?: string;
      listing_office_phone?: string;
      rawKeys?: string[];
      error?: string;
    } = { configured: false };

    try {
      const { isBridgeListingsEnabled, bridgeGetMlsListingById } = await import("@/lib/bridge-listings");
      if (isBridgeListingsEnabled()) {
        const row = await bridgeGetMlsListingById(id, { fullEnrich: true });
        bridge = {
          configured: true,
          listing_agent: row?.listing_agent || "",
          listing_office: row?.listing_office || "",
          listing_agent_phone: row?.listing_agent_phone || "",
          listing_office_phone: row?.listing_office_phone || "",
          rawKeys: row?.raw_data ? Object.keys(row.raw_data).sort() : [],
        };
      }
    } catch (e) {
      bridge = {
        configured: true,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    return NextResponse.json({
      ok: true,
      mls_id: id,
      retsConfigured,
      rets,
      bridge,
      summary: {
        retsFirm: rets?.resolved?.listing_office || "",
        retsAgent: rets?.resolved?.listing_agent || "",
        bridgeFirm: bridge.listing_office || "",
        bridgeAgent: bridge.listing_agent || "",
        officeAttemptHits: rets?.officeAttempts?.filter((a) => a.found).length ?? 0,
        agentAttemptHits: rets?.agentAttempts?.filter((a) => a.found).length ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown",
        stack: err instanceof Error ? err.stack?.slice(0, 800) : undefined,
      },
      { status: 500 },
    );
  }
}
