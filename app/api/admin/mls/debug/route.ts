import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

export const maxDuration = 60;

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "(MlsStatus=Active)";
  const limit = Number(searchParams.get("limit") || "3");

  try {
    const { rawSearch } = await import("@/lib/rets-client");
    const body = await rawSearch(query, limit);

    return NextResponse.json({
      ok: true,
      query,
      bodyLength: body.length,
      preview: body.slice(0, 5000),
      hasColumns: body.includes("<COLUMNS>"),
      hasData: body.includes("<DATA>"),
      replyCode: body.match(/ReplyCode="([^"]+)"/)?.[1],
      replyText: body.match(/ReplyText="([^"]+)"/)?.[1],
      recordCount: body.match(/Records="([^"]+)"/)?.[1],
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown",
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}
