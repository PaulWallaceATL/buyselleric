"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { adminUpdateSubmissionStatus } from "@/app/actions/admin";
import type { SellSubmissionAdminStatus, SellSubmissionRow } from "@/lib/types/db";

const options: { value: SellSubmissionAdminStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
];

export function AdminSubmissionStatus({ row }: { row: SellSubmissionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: SellSubmissionAdminStatus) {
    startTransition(async () => {
      const res = await adminUpdateSubmissionStatus(row.id, next);
      if (res.ok) {
        router.refresh();
      }
    });
  }

  return (
    <select
      value={row.admin_status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as SellSubmissionAdminStatus)}
      className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
