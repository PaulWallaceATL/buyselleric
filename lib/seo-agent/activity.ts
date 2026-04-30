import { adminInsertSeoAgentActivity, createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SeoAgentActivityLevel } from "@/lib/types/db";

export async function logSeoAgentActivity(params: {
  run_id: string;
  level: SeoAgentActivityLevel;
  kind: string;
  summary: string;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  const client = createSupabaseAdminClient();
  if (!client) return;
  const r = await adminInsertSeoAgentActivity(client, params);
  if (!r.ok) {
    console.error("[seo-agent] activity log insert failed:", r.error);
  }
}
