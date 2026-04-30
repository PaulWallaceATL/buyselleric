function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

/** When unset or not `true`, the heartbeat is a no-op (safe default). */
export function isSeoAgentEnabled(): boolean {
  return process.env.SEO_AGENT_ENABLED?.trim().toLowerCase() === "true";
}

export function seoAgentModel(): string {
  return process.env.SEO_AGENT_MODEL?.trim() || "gpt-5.5";
}

export function seoAgentMaxSeoPostsPerRun(): number {
  return parsePositiveInt(process.env.SEO_AGENT_MAX_SEO_POSTS_PER_RUN, 1, 5);
}

export function seoAgentMaxListingPostsPerRun(): number {
  return parsePositiveInt(process.env.SEO_AGENT_MAX_LISTING_POSTS_PER_RUN, 1, 10);
}

export function seoAgentAutoPublish(): boolean {
  return process.env.SEO_AGENT_AUTO_PUBLISH?.trim().toLowerCase() === "true";
}

export function seoAgentFeaturedMlsIds(): string[] {
  const raw = process.env.SEO_AGENT_FEATURED_MLS_IDS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
