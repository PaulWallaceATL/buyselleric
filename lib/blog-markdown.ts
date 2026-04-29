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

/** Ensure markdown headings start their own block when the author used only a single newline. */
function normalizeHeadingLineBreaks(md: string): string {
  return md.replace(/([^\n])\n(#{1,3}\s)/g, "$1\n\n$2");
}

/**
 * Line-based markdown → HTML: blank lines, headings, lists, and single newlines between
 * “real” lines become separate <p> blocks (fixes smushed copy when editors use one Enter between paragraphs).
 */
export function renderBlogBodyMarkdown(rawMd: string): string {
  const md = normalizeHeadingLineBreaks(stripHashtagSpamFromMarkdownBody(rawMd));
  if (!md.trim()) return "";

  const lines = md.split("\n");
  const html: string[] = [];
  let paraLines: string[] = [];

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
      html.push(`<h3>${applyInlineMarkdown(h3[1]!)}</h3>`);
      i++;
      continue;
    }
    if (h2) {
      flushParagraphs();
      html.push(`<h2>${applyInlineMarkdown(h2[1]!)}</h2>`);
      i++;
      continue;
    }
    if (h1) {
      flushParagraphs();
      html.push(`<h1>${applyInlineMarkdown(h1[1]!)}</h1>`);
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
