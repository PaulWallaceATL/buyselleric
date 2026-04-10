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

  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

      setMode("manual");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setGenerating(false);
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
            SEO-optimized version for your blog.
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
          <textarea ref={excerptRef} id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} placeholder="Short summary shown on the blog list page" className={input} />
        </div>

        <div>
          <label htmlFor="cover_image_url" className={label}>Cover image URL</label>
          <input id="cover_image_url" name="cover_image_url" type="url" defaultValue={post?.cover_image_url ?? ""} placeholder="https://..." className={input} />
        </div>

        <div>
          <label htmlFor="body" className={label}>Body (Markdown supported)</label>
          <textarea ref={bodyRef} id="body" name="body" rows={16} defaultValue={post?.body ?? ""} className={`${input} font-mono text-xs leading-relaxed`} required />
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
