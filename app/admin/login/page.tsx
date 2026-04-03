"use client";

import { ctaPrimary } from "@/lib/cta-styles";
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <p className="text-sm text-muted-foreground mb-2">buyselleric</p>
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage listings and seller inquiries.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full min-h-[52px] rounded-xl border-2 border-border bg-muted/30 px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus-ring outline-none"
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
