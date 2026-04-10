"use client";

import { useActionState, useState, useRef } from "react";
import { adminSaveBlogPost, type AdminBlogFormState } from "@/app/actions/admin-blog";
import type { BlogPostRow } from "@/lib/types/db";

const label = "mb-1 block text-sm font-medium text-foreground";
const input =
  "w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20";

type GenerationMode = "manual" | "conversational" | "url";

export function AdminBlogForm({ post }: { post?: BlogPostRow }) {
  const [state, action, pending] = useActionState<AdminBlogFormState, FormData>(adminSaveBlogPost, null);
  const [mode, setMode] = useState<GenerationMode>("manual");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiUrl, setAiUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(post?.cover_image_url ?? null);

  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const metaRef = useRef<HTMLTextAreaElement>(null);
  const keywordsRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    setGenerating(true);
    setAiError(null);

    try {
      const payload =
        mode === "conversational"
          ? { mode: "conversational", prompt: aiPrompt }
          : { mode: "url", url: aiUrl };

      const res = await fetch("/api/admin/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        setAiError(data.message || "Generation failed.");
        return;
      }

      if (titleRef.current) titleRef.current.value = data.title || "";
      if (slugRef.current) slugRef.current.value = data.slug || "";
      if (excerptRef.current) excerptRef.current.value = data.excerpt || "";
      if (bodyRef.current) bodyRef.current.value = data.body || "";

      if (data.cover_image_url && coverRef.current) {
        coverRef.current.value = data.cover_image_url;
        setCoverPreview(data.cover_image_url);
      }
      if (data.seo_keywords?.length && keywordsRef.current) {
        keywordsRef.current.value = data.seo_keywords.join(", ");
      }
      if (data.excerpt && metaRef.current) {
        metaRef.current.value = data.excerpt;
      }

      setMode("manual");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setAiError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok && data.url) {
        if (coverRef.current) coverRef.current.value = data.url;
        setCoverPreview(data.url);
      } else {
        setCoverPreview(URL.createObjectURL(file));
        setAiError(`Upload failed: ${data.message || "Unknown error"}. You can paste an image URL instead.`);
      }
    } catch (err) {
      setCoverPreview(URL.createObjectURL(file));
      setAiError(`Upload error: ${err instanceof Error ? err.message : "Network error"}. You can paste an image URL instead.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const modes: { key: GenerationMode; label: string }[] = [
    { key: "manual", label: "Write manually" },
    { key: "conversational", label: "AI from prompt" },
    { key: "url", label: "AI from URL" },
  ];

  return (
    <div className="space-y-8">
      {!post && (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">How do you want to create this post?</p>
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMode(m.key); setAiError(null); }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  mode === m.key
                    ? "bg-foreground text-background"
                    : "border border-border text-foreground hover:bg-muted/30"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "conversational" && !post && (
        <div className="rounded-2xl border border-border bg-muted/10 p-6">
          <h3 className="text-base font-semibold text-foreground">Describe your article</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell the AI what you want to write about—be as detailed or brief as you like.
          </p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            data-lenis-prevent
            placeholder='e.g. "Write about spring home maintenance tips for Atlanta homeowners, focusing on HVAC, gutters, and curb appeal before listing season"'
            className={`${input} mt-4`}
          />
          {aiError && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {aiError}
            </p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || aiPrompt.trim().length < 10}
            className="mt-4 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate article"}
          </button>
        </div>
      )}

      {mode === "url" && !post && (
        <div className="rounded-2xl border border-border bg-muted/10 p-6">
          <h3 className="text-base font-semibold text-foreground">Import from URL</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a link to an existing article. The AI will read it and create an original,
            SEO-optimized version for your blog. The cover image will be auto-detected if available.
          </p>
          <input
            type="url"
            value={aiUrl}
            onChange={(e) => setAiUrl(e.target.value)}
            placeholder="https://example.com/article-to-rewrite"
            className={`${input} mt-4`}
          />
          {aiError && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {aiError}
            </p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !aiUrl.trim()}
            className="mt-4 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Importing & rewriting…" : "Import & rewrite"}
          </button>
        </div>
      )}

      {generating && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-5 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <p className="text-sm text-muted-foreground">
            {mode === "url" ? "Fetching article and generating…" : "Generating article…"} This may take 15–30 seconds.
          </p>
        </div>
      )}

      <form action={action} className="space-y-6">
        {post && <input type="hidden" name="post_id" value={post.id} />}

        {state && !state.ok && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        )}

        <div>
          <label htmlFor="title" className={label}>Title</label>
          <input ref={titleRef} id="title" name="title" type="text" defaultValue={post?.title ?? ""} className={input} required />
        </div>

        <div>
          <label htmlFor="slug" className={label}>Slug</label>
          <input ref={slugRef} id="slug" name="slug" type="text" defaultValue={post?.slug ?? ""} placeholder="auto-generated from title" className={input} />
        </div>

        <div>
          <label htmlFor="author" className={label}>Author</label>
          <input id="author" name="author" type="text" defaultValue={post?.author ?? "Eric Adams"} className={input} />
        </div>

        <div>
          <label htmlFor="excerpt" className={label}>Excerpt</label>
          <textarea ref={excerptRef} id="excerpt" name="excerpt" rows={2} data-lenis-prevent defaultValue={post?.excerpt ?? ""} placeholder="Short summary shown on the blog list page" className={input} />
        </div>

        <div>
          <label htmlFor="meta_description" className={label}>Meta description (SEO)</label>
          <textarea ref={metaRef} id="meta_description" name="meta_description" rows={2} data-lenis-prevent defaultValue={post?.meta_description ?? ""} placeholder="Under 160 characters — shown in Google search results" className={input} />
        </div>

        <div>
          <label htmlFor="seo_keywords" className={label}>SEO keywords (comma-separated)</label>
          <input ref={keywordsRef} id="seo_keywords" name="seo_keywords" type="text" defaultValue={post?.seo_keywords?.join(", ") ?? ""} placeholder="atlanta real estate, home buying tips, georgia homes" className={input} />
        </div>

        <div>
          <label htmlFor="cover_image_url" className={label}>Cover image</label>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={coverRef}
                id="cover_image_url"
                name="cover_image_url"
                type="url"
                defaultValue={post?.cover_image_url ?? ""}
                placeholder="https://... or upload below"
                className={`${input} flex-1`}
                onChange={(e) => setCoverPreview(e.target.value || null)}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
                {uploading ? "Uploading…" : "Upload"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {aiError && mode === "manual" && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {aiError}
              </p>
            )}
            {coverPreview && (
              <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="body" className={label}>Body (Markdown supported)</label>
          <textarea
            ref={bodyRef}
            id="body"
            name="body"
            data-lenis-prevent
            defaultValue={post?.body ?? ""}
            className="block w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            style={{ height: "500px", overflowY: "scroll", touchAction: "pan-y" }}
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <input id="is_published" name="is_published" type="checkbox" defaultChecked={post?.is_published ?? false} className="h-4 w-4 rounded border-border" />
          <label htmlFor="is_published" className="text-sm font-medium text-foreground">Published</label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : post ? "Update post" : "Create post"}
        </button>
      </form>
    </div>
  );
}
