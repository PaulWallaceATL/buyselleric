"use client";

import {
  adminApproveAutogenBlogPost,
  adminDeleteBlogPostForm,
  adminRejectAutogenBlogPost,
  type AdminBlogFormState,
} from "@/app/actions/admin-blog";
import { useActionState } from "react";

type Props = Readonly<{
  postId: string;
  isPublished: boolean;
  isAutogen: boolean;
}>;

export function AdminBlogQuickActions({ postId, isPublished, isAutogen }: Props) {
  const [approveState, approveAction, approvePending] = useActionState<AdminBlogFormState, FormData>(
    adminApproveAutogenBlogPost,
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<AdminBlogFormState, FormData>(
    isAutogen ? adminRejectAutogenBlogPost : adminDeleteBlogPostForm,
    null,
  );

  const err =
    (approveState && !approveState.ok && approveState.message) ||
    (deleteState && !deleteState.ok && deleteState.message) ||
    null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isPublished && isAutogen ? (
        <form action={approveAction} className="inline">
          <input type="hidden" name="id" value={postId} />
          <button
            type="submit"
            disabled={approvePending || deletePending}
            className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {approvePending ? "Publishing…" : "Publish"}
          </button>
        </form>
      ) : null}

      <form
        action={deleteAction}
        className="inline"
        onSubmit={(e) => {
          if (
            !confirm(
              isPublished
                ? "Delete this published post? It will be removed from the site."
                : "Delete this draft permanently?",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={postId} />
        <button
          type="submit"
          disabled={approvePending || deletePending}
          className="rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
        >
          {deletePending ? "Deleting…" : "Delete"}
        </button>
      </form>

      {err ? <span className="text-xs text-red-600 dark:text-red-400">{err}</span> : null}
    </div>
  );
}
