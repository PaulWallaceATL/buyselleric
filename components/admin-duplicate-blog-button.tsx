"use client";

import { useActionState } from "react";
import { adminDuplicateBlogPost, type AdminBlogFormState } from "@/app/actions/admin-blog";

export function AdminDuplicateBlogButton({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<AdminBlogFormState, FormData>(adminDuplicateBlogPost, null);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={postId} />
      {state && !state.ok && (
        <span className="mr-2 text-xs text-red-500">{state.message}</span>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        {pending ? "Duplicating…" : "Duplicate"}
      </button>
    </form>
  );
}
