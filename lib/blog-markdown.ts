import { slugify } from "@/lib/format";

/** Strip trailing “#tag #tag2” spam (whole lines or tail of last line) from article bodies. */
export function stripHashtagSpamFromMarkdownBody(md: string): string {
  let s = md.replace(/\r\n/g, "\n").trimEnd();
  while (s.length > 0) {
    const lastNl = s.lastIndexOf("\n");
    const lastLine = (lastNl === -1 ? s : s.slice(lastNl + 1)).trim();
    if (/^(?:#[A-Za-z0-9_-]+\s*)+$/.test(lastLine)) {
      s = lastNl === -1 ? "" : s.slice(0, lastNl).trimEnd();
      continue;
    }
    break;
  }
  s = s.replace(/(?:\s+#[A-Za-z0-9_-]+)+\s*$/g, "").trimEnd();
  return s.trim();
}

function applyInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

/** Plain label from a markdown heading line (for TOC + stable ids). */
export function stripHeadingMarkdownSource(raw: string): string {
  return raw
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
  const base = slugify(stripHeadingMarkdownSource(rawHeadingInner)) || "section";
  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  usedIds.add(id);
  return id;
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
      html.push(`<h3 id="${escapeHtmlAttr(id)}">${applyInlineMarkdown(inner)}</h3>`);
      i++;
      continue;
    }
    if (h2) {
      flushParagraphs();
      const inner = h2[1]!;
      const id = assignHeadingId(inner, usedIds);
      html.push(`<h2 id="${escapeHtmlAttr(id)}">${applyInlineMarkdown(inner)}</h2>`);
      i++;
      continue;
    }
    if (h1) {
      flushParagraphs();
      const inner = h1[1]!;
      const id = assignHeadingId(inner, usedIds);
      html.push(`<h1 id="${escapeHtmlAttr(id)}">${applyInlineMarkdown(inner)}</h1>`);
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
