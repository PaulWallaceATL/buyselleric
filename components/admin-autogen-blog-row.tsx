"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  adminApproveAutogenBlogPost,
  adminRejectAutogenBlogPost,
  type AdminBlogFormState,
} from "@/app/actions/admin-blog";
import type { BlogPostRow } from "@/lib/types/db";

function kindLabel(kind: string | undefined): string {
  switch (kind) {
    case "new_listing":
      return "New listing";
    case "price_drop":
      return "Price drop";
    case "curated":
      return "Curated";
    default:
      return "Auto";
  }
}

export function AdminAutogenBlogRow({ post }: { post: BlogPostRow }) {
  const [approveState, approveAction, approvePending] = useActionState<AdminBlogFormState, FormData>(
    adminApproveAutogenBlogPost,
    null,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<AdminBlogFormState, FormData>(
    adminRejectAutogenBlogPost,
    null,
  );

  const busy = approvePending || rejectPending;
  const err =
    approveState && !approveState.ok
      ? approveState.message
      : rejectState && !rejectState.ok
        ? rejectState.message
        : null;

  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {kindLabel(post.post_kind)}
          </span>
          {!post.is_published ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              Pending
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Live
            </span>
          )}
        </div>
        <p className="mt-2 font-medium text-foreground">{post.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{post.slug}</p>
        {post.source_mls_id ? (
          <p className="mt-1 text-xs text-muted-foreground">
            MLS ID{" "}
            <Link href={`/listings/mls/${encodeURIComponent(post.source_mls_id)}`} className="text-ring underline-offset-2 hover:underline">
              {post.source_mls_id}
            </Link>
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Created {new Date(post.created_at).toLocaleString()}
          {post.published_at ? ` · Published ${new Date(post.published_at).toLocaleString()}` : ""}
        </p>
        {err ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {!post.is_published ? (
          <>
            <form action={approveAction} className="inline">
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {approvePending ? "Publishing…" : "Approve"}
              </button>
            </form>
            <form
              action={rejectAction}
              className="inline"
              onSubmit={(e) => {
                if (!confirm("Delete this draft permanently? This cannot be undone.")) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
              >
                {rejectPending ? "Removing…" : "Deny"}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              View live
            </Link>
            <Link
              href={`/admin/blog/${post.id}/edit`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              Edit
            </Link>
            <form
              action={rejectAction}
              className="inline"
              onSubmit={(e) => {
                if (
                  !confirm(
                    "This article is published on the site. Delete it permanently? This cannot be undone.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={post.id} />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
              >
                {rejectPending ? "Deleting…" : "Delete"}
              </button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
