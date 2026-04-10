import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import {
  extractContentFromUrl,
  generateFromPrompt,
  generateFromUrl,
} from "@/lib/ai-blog";

export const maxDuration = 60;

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY is not configured. Add it to your environment variables." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { mode, prompt, url } = body as {
    mode?: string;
    prompt?: string;
    url?: string;
  };

  try {
    if (mode === "conversational") {
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
        return NextResponse.json(
          { ok: false, message: "Please provide a description of at least 10 characters." },
          { status: 400 },
        );
      }
      const result = await generateFromPrompt(prompt.trim());
      return NextResponse.json({ ok: true, ...result });
    }

    if (mode === "url") {
      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { ok: false, message: "Please provide a valid URL." },
          { status: 400 },
        );
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
        if (!parsed.protocol.startsWith("http")) throw new Error();
      } catch {
        return NextResponse.json(
          { ok: false, message: "Invalid URL. Must start with http:// or https://." },
          { status: 400 },
        );
      }

      const content = await extractContentFromUrl(parsed.toString());
      if (content.length < 100) {
        return NextResponse.json(
          { ok: false, message: "Could not extract enough content from that URL. Try a different article." },
          { status: 400 },
        );
      }

      const result = await generateFromUrl(parsed.toString(), content);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json(
      { ok: false, message: "Invalid mode. Use 'conversational' or 'url'." },
      { status: 400 },
    );
  } catch (err) {
    console.error("Blog generation error:", err);
    const message = err instanceof Error ? err.message : "Generation failed. Please try again.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
