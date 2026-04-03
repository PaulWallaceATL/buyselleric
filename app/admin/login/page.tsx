"use client";

import { ctaPrimary } from "@/lib/cta-styles";
import { cardSurface } from "@/lib/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Invalid password.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className={`${cardSurface} w-full max-w-md space-y-8 p-8 sm:p-10`}>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            buyselleric
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Admin sign in
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Manage listings and seller inquiries.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[52px] rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-ring outline-none focus:border-ring/50 sm:rounded-2xl"
              placeholder="Password"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className={`${ctaPrimary} w-full disabled:opacity-50`}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-base text-muted-foreground">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 hover:text-foreground"
          >
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
