import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBlogForm } from "@/components/admin-blog-form";
import { AdminDeleteBlogForm } from "@/components/admin-delete-blog-form";
import { adminGetBlogPost, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function AdminEditBlogPostPage({ params }: Props): Promise<ReactNode> {
  const { id } = await params;
  const client = createSupabaseAdminClient();
  if (!client) {
    return <p className="text-sm text-muted-foreground">Supabase admin client is not configured.</p>;
  }

  const post = await adminGetBlogPost(client, id);
  if (!post) notFound();

  return (
    <div>
      <Link href="/admin/blog" className="text-sm text-muted-foreground hover:text-foreground">
        ← Blog posts
      </Link>
      <h1 className="mt-6 text-2xl font-medium tracking-tight text-foreground">Edit blog post</h1>
      <p className="mt-2 text-sm text-muted-foreground">{post.title}</p>
      <div className="mt-10">
        <AdminBlogForm post={post} />
      </div>
      <AdminDeleteBlogForm postId={post.id} />
    </div>
  );
}
