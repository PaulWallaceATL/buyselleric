import { AdminBlogForm } from "@/components/admin-blog-form";
import type { ReactNode } from "react";

export default function AdminNewBlogPostPage(): ReactNode {
  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-foreground">New blog post</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Publish when you are ready—drafts stay hidden from the public site.
      </p>
      <div className="mt-10">
        <AdminBlogForm />
      </div>
    </div>
  );
}
