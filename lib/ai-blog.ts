import OpenAI from "openai";
import { siteConfig } from "@/lib/config";
import { truncateMetaDescription } from "@/lib/seo";

let _client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export interface GeneratedBlogPost {
  title: string;
  slug: string;
  excerpt: string;
  /** SERP meta description; keep distinct from excerpt when possible (≤155 chars). */
  meta_description: string;
  body: string;
  seo_keywords: string[];
}

const SYSTEM_PROMPT = `You are a professional real estate blog writer for ${siteConfig.agentName} at ${siteConfig.name} (${siteConfig.brandSlug}), serving clients across ${siteConfig.primaryMarket}.

Your writing style:
- Professional but approachable — like a knowledgeable friend in the business
- Data-informed when possible (reference market trends, statistics, seasonal patterns)
- Actionable — give readers specific steps or insights they can use
- Locally relevant to Atlanta, Georgia, and surrounding metro areas

SEO requirements:
- Title should be compelling and include target keywords naturally
- Excerpt: 1-2 engaging sentences for the article card / intro (may be slightly longer than meta)
- meta_description: dedicated SERP snippet ONLY — max 155 characters, primary keyword near the start, no trailing ellipsis unless you stay under the limit
- Body in markdown with clear H2/H3 heading structure (one H1 in the body is OK if it matches the topic; prefer H2 for sections)
- Naturally incorporate relevant real estate keywords throughout
- Include a brief call-to-action mentioning ${siteConfig.agentName} near the end

Output format: Respond ONLY with valid JSON matching this exact schema:
{
  "title": "string",
  "slug": "string (lowercase-kebab-case)",
  "excerpt": "string (1-2 sentences for card/intro)",
  "meta_description": "string (max 155 characters for Google snippet)",
  "body": "string (markdown)",
  "seo_keywords": ["array", "of", "keyword", "strings"]
}

Do not wrap in markdown code fences. Return raw JSON only.`;

export async function generateFromPrompt(prompt: string): Promise<GeneratedBlogPost> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a blog article based on this description:\n\n${prompt}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  return parseAIResponse(text);
}

export async function generateFromUrl(url: string, extractedContent: string, _ogImage?: string | null): Promise<GeneratedBlogPost> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Rewrite the following article as an original blog post for our real estate website. Do NOT plagiarize — create entirely new content inspired by the topic and key points. Adapt it to the ${siteConfig.primaryMarket} market where relevant.

Source URL (for reference only): ${url}

Article content:
${extractedContent.slice(0, 8000)}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  return parseAIResponse(text);
}

function parseAIResponse(text: string): GeneratedBlogPost {
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.title || !parsed.body) {
    throw new Error("AI response missing required fields (title, body)");
  }

  const excerpt = String(parsed.excerpt || "");
  const metaRaw = String(parsed.meta_description || parsed.excerpt || "");

  return {
    title: String(parsed.title),
    slug: String(parsed.slug || ""),
    excerpt,
    meta_description: truncateMetaDescription(metaRaw),
    body: String(parsed.body),
    seo_keywords: Array.isArray(parsed.seo_keywords)
      ? parsed.seo_keywords.map(String)
      : [],
  };
}

export interface ExtractedContent {
  text: string;
  ogImage: string | null;
}

export async function extractContentFromUrl(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return {
    text: extractTextFromHtml(html),
    ogImage: extractOgImage(html),
  };
}

function extractOgImage(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return ogMatch[1];

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (twitterMatch?.[1]) return twitterMatch[1];

  return null;
}

function extractTextFromHtml(html: string): string {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");

  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = text.match(/<main[\s\S]*?<\/main>/i);
  if (articleMatch) {
    text = articleMatch[0];
  } else if (mainMatch) {
    text = mainMatch[0];
  }

  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, " ");
  text = text.trim();

  return text.slice(0, 12000);
}
