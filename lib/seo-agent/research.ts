import { siteConfig } from "@/lib/config";
import { seoAgentModel } from "@/lib/seo-agent/config";
import { getSeoAgentOpenAI } from "@/lib/seo-agent/openai-client";

export interface SeoResearchMemo {
  summary: string;
  suggested_topic: string;
  suggested_slug_hint?: string;
  seo_keywords: string[];
  citations: { title?: string; url?: string }[];
}

function parseResearchJson(text: string): SeoResearchMemo {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const citationsRaw = Array.isArray(parsed.citations) ? parsed.citations : [];
  const citations: { title?: string; url?: string }[] = citationsRaw.map((c) => {
    const o = c as Record<string, unknown>;
    const out: { title?: string; url?: string } = {};
    if (typeof o.title === "string") out.title = o.title;
    if (typeof o.url === "string") out.url = o.url;
    return out;
  });
  const memo: SeoResearchMemo = {
    summary: String(parsed.summary || ""),
    suggested_topic: String(
      parsed.suggested_topic || "Georgia real estate market insights for buyers and sellers",
    ),
    seo_keywords: Array.isArray(parsed.seo_keywords)
      ? (parsed.seo_keywords as unknown[]).map((k) => String(k)).filter(Boolean)
      : [],
    citations,
  };
  if (typeof parsed.suggested_slug_hint === "string" && parsed.suggested_slug_hint.trim()) {
    memo.suggested_slug_hint = parsed.suggested_slug_hint.trim();
  }
  return memo;
}

/**
 * Uses OpenAI Responses API with hosted web search for current SEO / market context.
 */
export async function runSeoWebResearch(): Promise<{
  memo: SeoResearchMemo;
  response_id: string | undefined;
  usage: Record<string, unknown> | undefined;
}> {
  const openai = getSeoAgentOpenAI();
  const model = seoAgentModel();
  const instructions = `You are an SEO researcher for ${siteConfig.name} (${siteConfig.primaryMarket} real estate, agent ${siteConfig.agentName}). Use the web search tool to find timely, credible topics relevant to home buyers and sellers.`;

  const user = `Search the web for current real estate angles relevant to Georgia / ${siteConfig.primaryMarket} (market trends, seasonal buying, mortgage context, local neighborhoods — avoid unrelated national politics).

Then respond with ONLY valid JSON (no markdown code fences) in exactly this shape:
{
  "summary": "2-5 sentences synthesizing what you found",
  "suggested_topic": "one specific blog article topic to write next",
  "suggested_slug_hint": "optional-short-kebab-hint",
  "seo_keywords": ["5-12", "plain", "keyword", "phrases"],
  "citations": [{"title":"source title","url":"https://..."}]
}
Include 2-8 citations with HTTPS URLs when the search provides them.`;

  const response = await openai.responses.create({
    model,
    instructions,
    input: user,
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    max_output_tokens: 4096,
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error("Empty research response from OpenAI");
  const memo = parseResearchJson(text);
  const usage = response.usage ? (JSON.parse(JSON.stringify(response.usage)) as Record<string, unknown>) : undefined;
  return { memo, response_id: response.id, usage };
}
