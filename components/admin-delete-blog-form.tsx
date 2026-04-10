"use client";

import { useActionState } from "react";
import { adminDeleteBlogPostForm, type AdminBlogFormState } from "@/app/actions/admin-blog";

export function AdminDeleteBlogForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<AdminBlogFormState, FormData>(adminDeleteBlogPostForm, null);

  return (
    <form action={action} className="mt-16 border-t border-border pt-8">
      <input type="hidden" name="id" value={postId} />
      {state && !state.ok && (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
      <p className="text-sm text-muted-foreground">Permanently remove this blog post.</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
      >
        {pending ? "Deleting…" : "Delete post"}
      </button>
    </form>
  );
}
