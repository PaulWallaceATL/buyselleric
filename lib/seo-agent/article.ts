import { siteConfig } from "@/lib/config";
import type { GeneratedBlogPost } from "@/lib/ai-blog";
import { parseGeneratedBlogJson } from "@/lib/ai-blog";
import { seoAgentModel } from "@/lib/seo-agent/config";
import { getSeoAgentOpenAI } from "@/lib/seo-agent/openai-client";
import type { SeoResearchMemo } from "@/lib/seo-agent/research";

const ARTICLE_INSTRUCTIONS = `You are a professional real estate blog writer. Output ONLY valid JSON (no markdown fences) with keys:
title, slug (lowercase-kebab-case), excerpt, meta_description (max 155 chars for Google), body (markdown with multiple ## and ### section headings, no hashtag spam), seo_keywords (plain strings, no #).

Rules:
- Professional, helpful, locally relevant to ${siteConfig.primaryMarket}.
- Do not invent statistics; if uncertain, speak generally.
- End with a short CTA to contact ${siteConfig.agentName}.
- Prefer ## and ### headings (clear hierarchy for a table of contents).`;

/** Second step: longform JSON article from research memo (no web search). */
export async function generateSeoArticleFromResearch(memo: SeoResearchMemo): Promise<{
  post: GeneratedBlogPost;
  response_id: string | undefined;
  usage: Record<string, unknown> | undefined;
}> {
  const openai = getSeoAgentOpenAI();
  const model = seoAgentModel();

  const user = `Write one full blog article based on this research.

Research summary:
${memo.summary}

Primary topic:
${memo.suggested_topic}

Keywords to weave in naturally:
${memo.seo_keywords.join(", ")}

Optional reference URLs (you may link 1-3 in markdown in the body if helpful):
${memo.citations
  .map((c) => (c.url ? `- ${c.title ?? ""}: ${c.url}` : ""))
  .filter(Boolean)
  .join("\n")}`;

  const response = await openai.responses.create({
    model,
    instructions: ARTICLE_INSTRUCTIONS,
    input: user,
    max_output_tokens: 8000,
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error("Empty article response from OpenAI");
  const post = parseGeneratedBlogJson(text);
  const usage = response.usage
    ? (JSON.parse(JSON.stringify(response.usage)) as Record<string, unknown>)
    : undefined;
  return { post, response_id: response.id, usage };
}
