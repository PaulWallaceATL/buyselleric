import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

export const maxDuration = 60;

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("id");
  const photoNum = searchParams.get("photo") || "*";
  const location = searchParams.get("location") || "1";

  if (!listingId) {
    return NextResponse.json({ error: "Missing ?id= parameter" }, { status: 400 });
  }

  try {
    const loginUrl = process.env.RETS_LOGIN_URL!;
    const username = process.env.RETS_USERNAME!;
    const password = process.env.RETS_PASSWORD!;

    // Login
    const initialRes = await fetch(loginUrl, {
      headers: { "User-Agent": "BuySellEric/1.0", "RETS-Version": "RETS/1.7.2" },
      redirect: "manual",
    });
    const wwwAuth = initialRes.headers.get("www-authenticate") ?? "";
    const params: Record<string, string> = {};
    for (const m of wwwAuth.slice(7).matchAll(/(\w+)="([^"]+)"/g)) {
      if (m[1] && m[2]) params[m[1]] = m[2];
    }
    const realm = params.realm!;
    const nonce = params.nonce!;

    function buildAuth(uri: string, nc: number): string {
      const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
      const ha2 = crypto.createHash("md5").update(`GET:${uri}`).digest("hex");
      const cnonce = crypto.randomBytes(8).toString("hex");
      const ncStr = nc.toString(16).padStart(8, "0");
      const response = params.qop
        ? crypto.createHash("md5").update(`${ha1}:${nonce}:${ncStr}:${cnonce}:auth:${ha2}`).digest("hex")
        : crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
      let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
      if (params.qop) header += `, qop=auth, nc=${ncStr}, cnonce="${cnonce}"`;
      return header;
    }

    const loginUri = new URL(loginUrl).pathname;
    const loginRes = await fetch(loginUrl, {
      headers: {
        "User-Agent": "BuySellEric/1.0",
        "RETS-Version": "RETS/1.7.2",
        Authorization: buildAuth(loginUri, 1),
      },
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const loginBody = await loginRes.text();

    const baseUrl = new URL(loginUrl).origin;
    const getObjectMatch = loginBody.match(/GetObject=([^\s<]+)/);
    const getObjectUrl = getObjectMatch ? baseUrl + getObjectMatch[1] : baseUrl + "/server/getobject";

    // Try GetObject
    const objParams = new URLSearchParams({
      Type: "Photo",
      Resource: "Property",
      ID: `${listingId}:${photoNum}`,
      Location: location,
    }).toString();
    const fullUrl = `${getObjectUrl}?${objParams}`;
    const uri = new URL(fullUrl).pathname + "?" + objParams;

    const photoRes = await fetch(fullUrl, {
      headers: {
        "User-Agent": "BuySellEric/1.0",
        "RETS-Version": "RETS/1.7.2",
        Authorization: buildAuth(uri, 2),
        Cookie: cookie,
      },
      redirect: "manual",
    });

    const headers: Record<string, string> = {};
    photoRes.headers.forEach((value, key) => { headers[key] = value; });

    const contentType = photoRes.headers.get("content-type") ?? "";
    let body: string | undefined;
    if (!contentType.startsWith("image/") && photoRes.body) {
      const text = await photoRes.text();
      body = text.slice(0, 2000);
    }

    return NextResponse.json({
      ok: true,
      url: fullUrl,
      status: photoRes.status,
      statusText: photoRes.statusText,
      contentType,
      headers,
      body,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown",
    }, { status: 500 });
  }
}
