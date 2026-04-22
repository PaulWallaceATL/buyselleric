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
  const type = searchParams.get("type") || "resources";
  const resource = searchParams.get("resource") || "Property";
  const classId = searchParams.get("class") || "Residential";

  try {
    const { getMetadataResources, getMetadataClasses, getMetadataTable } = await import("@/lib/rets-client");

    if (type === "resources") {
      const data = await getMetadataResources();
      return NextResponse.json({ ok: true, type: "resources", data });
    }

    if (type === "classes") {
      const data = await getMetadataClasses(resource);
      return NextResponse.json({ ok: true, type: "classes", resource, data });
    }

    if (type === "table") {
      const data = await getMetadataTable(resource, classId);
      return NextResponse.json({ ok: true, type: "table", resource, class: classId, data });
    }

    return NextResponse.json({ error: "Use ?type=resources|classes|table" }, { status: 400 });
  } catch (err) {
    console.error("RETS metadata error:", err);
    const message = err instanceof Error ? err.message : "RETS connection failed";
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return NextResponse.json({ ok: false, error: message, stack }, { status: 500 });
  }
}
