"use client";

import { renderBlogBodyMarkdown } from "@/lib/blog-markdown";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = Readonly<{
  name: string;
  defaultValue?: string;
  required?: boolean;
}>;

const TOOLBAR_BTN =
  "rounded-md border border-border bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50";

/**
 * Markdown body editor with a toolbar that inserts markdown the renderer understands:
 *  - bold / italic / link
 *  - H2 / H3 (with optional explicit anchor id via `## Heading {#custom}`)
 *  - bullet / numbered lists
 *  - blockquote / horizontal rule
 *  - image upload (uses /api/admin/blog/upload)
 *  - YouTube/Vimeo embed via `@video https://...` line
 *
 * Renders a live preview alongside on `lg+`.
 */
export function AdminBlogBodyEditor({ name, defaultValue, required }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== value) {
      textareaRef.current.value = value;
    }
  }, [value]);

  const previewHtml = useMemo(() => renderBlogBodyMarkdown(value || ""), [value]);

  function getSelection(): { start: number; end: number; selected: string } {
    const ta = textareaRef.current!;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    return { start, end, selected: ta.value.slice(start, end) };
  }

  function replaceSelection(prefix: string, suffix = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start, end, selected } = getSelection();
    const inner = selected || placeholder;
    const next = ta.value.slice(0, start) + prefix + inner + suffix + ta.value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + prefix.length + inner.length + suffix.length;
      ta.setSelectionRange(start + prefix.length, cursor - suffix.length);
    });
  }

  function insertAtLineStart(prefix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start } = getSelection();
    const before = ta.value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const next = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
    });
  }

  function insertBlock(block: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start, end } = getSelection();
    const before = ta.value.slice(0, end);
    const needsLeadingNewline = before.length > 0 && !before.endsWith("\n\n");
    const lead = needsLeadingNewline ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const tail = ta.value.slice(end);
    const trail = tail.startsWith("\n") ? "\n" : "\n\n";
    const inserted = `${lead}${block}${trail}`;
    const next = ta.value.slice(0, start) + inserted + tail;
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + inserted.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  function onHeading(depth: 2 | 3) {
    const { selected } = getSelection();
    const text = selected || (depth === 2 ? "Section heading" : "Sub heading");
    insertBlock(`${"#".repeat(depth)} ${text}`);
  }

  function onAnchorHeading() {
    const slug = window.prompt("Anchor id for this section (letters, numbers, dashes):", "section");
    if (!slug) return;
    const cleaned = slug
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!cleaned) return;
    const text = window.prompt("Heading text:", "Section heading") ?? "Section heading";
    insertBlock(`## ${text} {#${cleaned}}`);
  }

  function onLink() {
    const url = window.prompt("Link URL (https://...):");
    if (!url) return;
    const { selected } = getSelection();
    replaceSelection("[", `](${url})`, selected || "link text");
  }

  function onVideo() {
    const url = window.prompt("YouTube or Vimeo URL:");
    if (!url) return;
    insertBlock(`@video ${url.trim()}`);
  }

  async function onImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; url?: string; message?: string };
      if (!data.ok || !data.url) {
        setError(data.message || "Image upload failed.");
      } else {
        const alt = file.name.replace(/\.[^.]+$/, "");
        insertBlock(`![${alt}](${data.url})`);
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={TOOLBAR_BTN} onClick={() => onHeading(2)} title="Heading 2 (section)">
          H2
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={() => onHeading(3)} title="Heading 3 (subsection)">
          H3
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={onAnchorHeading} title="Insert section with explicit anchor id">
          Anchor
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button type="button" className={TOOLBAR_BTN} onClick={() => replaceSelection("**", "**", "bold")} title="Bold">
          B
        </button>
        <button type="button" className={`${TOOLBAR_BTN} italic`} onClick={() => replaceSelection("*", "*", "italic")} title="Italic">
          I
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={onLink} title="Link">
          Link
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button type="button" className={TOOLBAR_BTN} onClick={() => insertAtLineStart("- ")} title="Bulleted list">
          • List
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={() => insertAtLineStart("1. ")} title="Numbered list">
          1. List
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={() => insertAtLineStart("> ")} title="Quote">
          Quote
        </button>
        <button type="button" className={TOOLBAR_BTN} onClick={() => insertBlock("---")} title="Divider">
          ⎯
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <label
          className={`${TOOLBAR_BTN} cursor-pointer ${uploading ? "opacity-60" : ""}`}
          title="Insert image (uploads to your blog bucket)"
        >
          {uploading ? "Uploading…" : "Image"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onImageFileChange}
            disabled={uploading}
          />
        </label>
        <button type="button" className={TOOLBAR_BTN} onClick={onVideo} title="Embed YouTube/Vimeo">
          Video
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <textarea
          ref={textareaRef}
          name={name}
          defaultValue={defaultValue ?? ""}
          onChange={(e) => setValue(e.target.value)}
          required={required}
          data-lenis-prevent
          className="block h-[520px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder={"## Section heading\n\nWrite your post here. Use the toolbar to add headings, anchors, images, and video.\n\n@video https://www.youtube.com/watch?v=...\n\n![alt text](https://...)"}
        />
        <div
          className="prose prose-sm h-[520px] max-w-none overflow-y-auto rounded-lg border border-border bg-background p-4 [--tw-prose-body:var(--muted-foreground)] [--tw-prose-headings:var(--foreground)] prose-headings:tracking-tight prose-h2:mt-6 prose-h3:mt-5 prose-a:text-ring"
          dangerouslySetInnerHTML={{ __html: previewHtml || "<p class=\"text-muted-foreground\">Live preview…</p>" }}
        />
      </div>
    </div>
  );
}
