import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

export default async function AdminSecureLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactNode> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link href="/admin" className="hover:opacity-80">
              Dashboard
            </Link>
            <Link href="/admin/listings" className="hover:opacity-80">
              Listings
            </Link>
            <Link href="/admin/submissions" className="hover:opacity-80">
              Submissions
            </Link>
            <Link href="/admin/blog" className="hover:opacity-80">
              Blog
            </Link>
            <Link href="/admin/seo-agent" className="hover:opacity-80">
              AI SEO agent
            </Link>
            <Link href="/admin/mls" className="hover:opacity-80">
              MLS
            </Link>
            <Link href="/listings" className="text-muted-foreground hover:text-foreground">
              Public listings
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
          </nav>
          <AdminLogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
