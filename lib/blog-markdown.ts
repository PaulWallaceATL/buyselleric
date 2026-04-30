import { slugify } from "@/lib/format";

/**
 * Strip ALL hashtag tokens from article bodies (not just trailing spam) while leaving
 * markdown headings (`#`, `##`, `###` followed by a space at start of line) intact.
 *
 * Removes:
 *   - whole "#tag #tag2 #tag3" lines anywhere in the body
 *   - trailing "... #tag #tag2" tails
 *   - inline " #tag" tokens between words
 */
export function stripHashtagSpamFromMarkdownBody(md: string): string {
  const out: string[] = [];
  for (const rawLine of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine;
    const trimmed = line.trim();
    if (/^(?:#[A-Za-z0-9_-]+\s*)+$/.test(trimmed)) continue;
    if (/^#{1,6}\s/.test(trimmed)) {
      out.push(line);
      continue;
    }
    out.push(line.replace(/(^|\s)#[A-Za-z0-9_-]+(?=\s|$|[.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trimEnd());
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, src: string) => {
      const safeAlt = escapeHtml(alt);
      const safeSrc = escapeHtml(src);
      return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" class="my-6 h-auto w-full rounded-2xl" />`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

/** `## Heading {#explicit-id}` → split into label + optional explicit id. */
function parseExplicitHeadingId(raw: string): { label: string; explicitId: string | null } {
  const m = raw.match(/^(.*?)\s*\{#([A-Za-z][A-Za-z0-9_-]*)\}\s*$/);
  if (m) return { label: m[1]!.trim(), explicitId: m[2]! };
  return { label: raw.trim(), explicitId: null };
}

/** Plain label from a markdown heading line (for TOC + stable ids). */
export function stripHeadingMarkdownSource(raw: string): string {
  const { label } = parseExplicitHeadingId(raw);
  return label
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Ensure markdown headings start their own block when the author used only a single newline. */
function normalizeHeadingLineBreaks(md: string): string {
  return md.replace(/([^\n])\n(#{1,3}\s)/g, "$1\n\n$2");
}

export function prepareBlogBodyMarkdown(rawMd: string): string {
  return normalizeHeadingLineBreaks(stripHashtagSpamFromMarkdownBody(rawMd));
}

export function assignHeadingId(rawHeadingInner: string, usedIds: Set<string>): string {
  const { explicitId } = parseExplicitHeadingId(rawHeadingInner);
  const base = explicitId || slugify(stripHeadingMarkdownSource(rawHeadingInner)) || "section";
  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  usedIds.add(id);
  return id;
}

/** Inner HTML to render for a heading line (label only, drops the {#id} suffix). */
function renderHeadingLabelMarkdown(rawHeadingInner: string): string {
  const { label } = parseExplicitHeadingId(rawHeadingInner);
  return applyInlineMarkdown(label);
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;

function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.replace(/^\/embed\//, "").split("/")[0]!;
        return YOUTUBE_ID_RE.test(id) ? id : null;
      }
      const v = u.searchParams.get("v");
      if (v && YOUTUBE_ID_RE.test(v)) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function vimeoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;
    const seg = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return /^\d{6,}$/.test(seg) ? seg : null;
  } catch {
    return null;
  }
}

function videoEmbedHtml(rawUrl: string): string | null {
  const yt = youtubeIdFromUrl(rawUrl);
  if (yt) {
    return `<div class="my-8 aspect-video w-full overflow-hidden rounded-2xl bg-muted"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="YouTube video" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="h-full w-full"></iframe></div>`;
  }
  const v = vimeoIdFromUrl(rawUrl);
  if (v) {
    return `<div class="my-8 aspect-video w-full overflow-hidden rounded-2xl bg-muted"><iframe src="https://player.vimeo.com/video/${v}" title="Vimeo video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="h-full w-full"></iframe></div>`;
  }
  return null;
}

export type BlogTocItem = { depth: 2 | 3; text: string; id: string };

/** Headings for sticky TOC (H2/H3 only; must match ids emitted by `renderBlogBodyMarkdown`). */
export function extractBlogToc(rawMd: string): BlogTocItem[] {
  const md = prepareBlogBodyMarkdown(rawMd);
  if (!md.trim()) return [];

  const lines = md.split("\n");
  const usedIds = new Set<string>();
  const out: BlogTocItem[] = [];

  for (const line of lines) {
    const t = line.trim();
    const h3 = t.match(/^###\s*(.+)$/);
    const h2 = t.match(/^##(?!#)\s*(.+)$/);
    if (h3) {
      const inner = h3[1]!;
      out.push({
        depth: 3,
        text: stripHeadingMarkdownSource(inner),
        id: assignHeadingId(inner, usedIds),
      });
      continue;
    }
    if (h2) {
      const inner = h2[1]!;
      out.push({
        depth: 2,
        text: stripHeadingMarkdownSource(inner),
        id: assignHeadingId(inner, usedIds),
      });
    }
  }
  return out;
}

/** Join soft-wrapped fragments; split hard line breaks into separate paragraphs when not a continuation. */
function linesToParagraphChunks(lines: string[]): string[] {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];
  const out: string[] = [];
  let buf = trimmed[0]!;
  for (let i = 1; i < trimmed.length; i++) {
    const next = trimmed[i]!;
    const joinSpace =
      /^[a-z(\u2019'"`(]/.test(next) && /[^.?:!)\]\"'"]$/.test(buf.trimEnd());
    if (joinSpace) buf += " " + next;
    else {
      out.push(buf);
      buf = next;
    }
  }
  out.push(buf);
  return out;
}

/**
 * Line-based markdown → HTML: blank lines, headings, lists, and single newlines between
 * “real” lines become separate <p> blocks (fixes smushed copy when editors use one Enter between paragraphs).
 */
export function renderBlogBodyMarkdown(rawMd: string): string {
  const md = prepareBlogBodyMarkdown(rawMd);
  if (!md.trim()) return "";

  const lines = md.split("\n");
  const html: string[] = [];
  let paraLines: string[] = [];
  const usedIds = new Set<string>();

  const flushParagraphs = () => {
    if (paraLines.length === 0) return;
    for (const chunk of linesToParagraphChunks(paraLines)) {
      html.push(`<p>${applyInlineMarkdown(chunk)}</p>`);
    }
    paraLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      flushParagraphs();
      i++;
      continue;
    }

    const h3 = line.match(/^###\s*(.+)$/);
    const h2 = line.match(/^##(?!#)\s*(.+)$/);
    const h1 = line.match(/^#(?!#)\s*(.+)$/);
    if (h3) {
      flushParagraphs();
      const inner = h3[1]!;
      const id = assignHeadingId(inner, usedIds);
      html.push(`<h3 id="${escapeHtmlAttr(id)}">${renderHeadingLabelMarkdown(inner)}</h3>`);
      i++;
      continue;
    }
    if (h2) {
      flushParagraphs();
      const inner = h2[1]!;
      const id = assignHeadingId(inner, usedIds);
      html.push(`<h2 id="${escapeHtmlAttr(id)}">${renderHeadingLabelMarkdown(inner)}</h2>`);
      i++;
      continue;
    }
    if (h1) {
      flushParagraphs();
      const inner = h1[1]!;
      const id = assignHeadingId(inner, usedIds);
      html.push(`<h1 id="${escapeHtmlAttr(id)}">${renderHeadingLabelMarkdown(inner)}</h1>`);
      i++;
      continue;
    }

    const videoMatch = line.match(/^@video\s+(\S+)\s*$/i);
    if (videoMatch) {
      const embed = videoEmbedHtml(videoMatch[1]!);
      if (embed) {
        flushParagraphs();
        html.push(embed);
        i++;
        continue;
      }
    }

    const standaloneImage = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/);
    if (standaloneImage) {
      flushParagraphs();
      const alt = escapeHtml(standaloneImage[1]!);
      const src = escapeHtml(standaloneImage[2]!);
      html.push(
        `<figure class="my-8"><img src="${src}" alt="${alt}" loading="lazy" class="h-auto w-full rounded-2xl" />${alt ? `<figcaption class="mt-2 text-center text-sm text-muted-foreground">${alt}</figcaption>` : ""}</figure>`,
      );
      i++;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraphs();
      const items: string[] = [];
      while (i < lines.length) {
        const L = lines[i]!.trim();
        if (!L) break;
        if (!L.startsWith("- ") && !L.startsWith("* ")) break;
        items.push(`<li>${applyInlineMarkdown(L.replace(/^[*-]\s+/, ""))}</li>`);
        i++;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushParagraphs();
      const items: string[] = [];
      while (i < lines.length) {
        const L = lines[i]!.trim();
        if (!L) break;
        if (!/^\d+\.\s/.test(L)) break;
        items.push(`<li>${applyInlineMarkdown(L.replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraphs();
      const text = line.replace(/^\s*>\s?/, "");
      html.push(`<blockquote>${applyInlineMarkdown(text)}</blockquote>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      flushParagraphs();
      html.push("<hr />");
      i++;
      continue;
    }

    if (/^\*\*.+\*\*$/.test(line) && line.length < 220) {
      flushParagraphs();
      html.push(
        `<p class="blog-deck text-xl font-semibold leading-snug text-foreground">${applyInlineMarkdown(line)}</p>`,
      );
      i++;
      continue;
    }

    paraLines.push(line);
    i++;
  }
  flushParagraphs();
  return html.join("\n");
}
