import OpenAI from "openai";
import { siteConfig } from "@/lib/config";

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
  body: string;
  seo_keywords: string[];
}

const SYSTEM_PROMPT = `You are a professional real estate blog writer for ${siteConfig.agentName} at ${siteConfig.name} (${siteConfig.brandSlug}), serving the ${siteConfig.primaryMarket} area and broader Georgia market.

Your writing style:
- Professional but approachable — like a knowledgeable friend in the business
- Data-informed when possible (reference market trends, statistics, seasonal patterns)
- Actionable — give readers specific steps or insights they can use
- Locally relevant to Atlanta, Georgia, and surrounding metro areas

SEO requirements:
- Title should be compelling and include target keywords naturally
- Excerpt should be 1-2 sentences that work as a meta description (under 160 characters preferred)
- Body in markdown with clear H2/H3 heading structure
- Naturally incorporate relevant real estate keywords throughout
- Include a brief call-to-action mentioning ${siteConfig.agentName} near the end

Output format: Respond ONLY with valid JSON matching this exact schema:
{
  "title": "string",
  "slug": "string (lowercase-kebab-case)",
  "excerpt": "string (1-2 sentences, under 160 chars)",
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

export async function generateFromUrl(url: string, extractedContent: string): Promise<GeneratedBlogPost> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Rewrite the following article as an original blog post for our real estate website. Do NOT plagiarize — create entirely new content inspired by the topic and key points. Adapt it to the ${siteConfig.primaryMarket} / Georgia market where relevant.

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

  return {
    title: String(parsed.title),
    slug: String(parsed.slug || ""),
    excerpt: String(parsed.excerpt || ""),
    body: String(parsed.body),
    seo_keywords: Array.isArray(parsed.seo_keywords)
      ? parsed.seo_keywords.map(String)
      : [],
  };
}

export async function extractContentFromUrl(url: string): Promise<string> {
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
  return extractTextFromHtml(html);
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
