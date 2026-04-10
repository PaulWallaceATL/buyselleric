import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function ext(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "File too large (5 MB max)" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, message: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  const path = `blog/${crypto.randomUUID()}.${ext(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from("listing-images").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Blog image upload error:", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const { data } = client.storage.from("listing-images").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
