"use client";

import { ctaPrimary } from "@/lib/cta-styles";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeoAgentRunButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/seo-agent/run", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        run_id?: string;
        skipped?: boolean;
        errors?: string[];
        created_seo_slugs?: string[];
        created_listing?: { mls_id: string; slug?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Request failed.");
        return;
      }
      const parts: string[] = [];
      if (data.run_id) parts.push(`Run ${data.run_id}`);
      if (data.skipped) parts.push("(agent disabled — no work performed)");
      if (data.created_seo_slugs?.length) parts.push(`SEO: ${data.created_seo_slugs.join(", ")}`);
      if (data.created_listing?.length) parts.push(`Listings: ${data.created_listing.map((c) => c.slug ?? c.mls_id).join(", ")}`);
      if (data.errors?.length) parts.push(`Errors: ${data.errors.join("; ")}`);
      setMessage(parts.join(" · ") || "Done.");
      router.refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className={ctaPrimary} disabled={pending} onClick={run}>
        {pending ? "Running…" : "Run SEO agent now"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
