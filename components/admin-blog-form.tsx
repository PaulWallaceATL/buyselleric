"use client";

import { useActionState } from "react";
import { adminSaveBlogPost, type AdminBlogFormState } from "@/app/actions/admin-blog";
import type { BlogPostRow } from "@/lib/types/db";

const label = "mb-1 block text-sm font-medium text-foreground";
const input =
  "w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20";

export function AdminBlogForm({ post }: { post?: BlogPostRow }) {
  const [state, action, pending] = useActionState<AdminBlogFormState, FormData>(adminSaveBlogPost, null);

  return (
    <form action={action} className="space-y-6">
      {post && <input type="hidden" name="post_id" value={post.id} />}

      {state && !state.ok && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="title" className={label}>Title</label>
        <input id="title" name="title" type="text" defaultValue={post?.title ?? ""} className={input} required />
      </div>

      <div>
        <label htmlFor="slug" className={label}>Slug</label>
        <input id="slug" name="slug" type="text" defaultValue={post?.slug ?? ""} placeholder="auto-generated from title" className={input} />
      </div>

      <div>
        <label htmlFor="author" className={label}>Author</label>
        <input id="author" name="author" type="text" defaultValue={post?.author ?? "Eric Adams"} className={input} />
      </div>

      <div>
        <label htmlFor="excerpt" className={label}>Excerpt</label>
        <textarea id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} placeholder="Short summary shown on the blog list page" className={input} />
      </div>

      <div>
        <label htmlFor="cover_image_url" className={label}>Cover image URL</label>
        <input id="cover_image_url" name="cover_image_url" type="url" defaultValue={post?.cover_image_url ?? ""} placeholder="https://..." className={input} />
      </div>

      <div>
        <label htmlFor="body" className={label}>Body (Markdown supported)</label>
        <textarea id="body" name="body" rows={16} defaultValue={post?.body ?? ""} className={`${input} font-mono text-xs leading-relaxed`} required />
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
  );
}
