import { AdminSubmissionStatus } from "@/components/admin-submission-status";
import { adminListSubmissions, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

export default async function AdminSubmissionsPage(): Promise<ReactNode> {
  const client = createSupabaseAdminClient();
  const rows = client ? await adminListSubmissions(client) : [];

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight text-foreground">Seller inquiries</h1>
      <p className="mt-2 text-sm text-muted-foreground">Submissions from the sell-your-home form.</p>

      {!client ? (
        <p className="mt-8 text-sm text-muted-foreground">Supabase admin client is not configured.</p>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{r.email}</div>
                    {r.phone ? <div>{r.phone}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[220px]">
                    <div className="line-clamp-3">
                      {[r.property_address, r.city, r.state, r.postal_code].filter(Boolean).join(", ")}
                    </div>
                    {r.message ? (
                      <p className="mt-2 line-clamp-2 text-xs opacity-80">{r.message}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <AdminSubmissionStatus row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
