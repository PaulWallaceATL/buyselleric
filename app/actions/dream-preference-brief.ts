"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DreamBriefFormState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

export async function submitDreamPreferenceBrief(
  _prev: DreamBriefFormState,
  formData: FormData,
): Promise<DreamBriefFormState> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const dream_brief = String(formData.get("dream_brief") ?? "").trim();
  const dream_filters_raw = String(formData.get("dream_filters") ?? "").trim();
  const shortlist_raw = String(formData.get("shortlist_mls_ids") ?? "").trim();

  if (!full_name || !email) {
    return { ok: false, message: "Name and email are required." };
  }
  if (!dream_brief) {
    return { ok: false, message: "Preference brief is missing. Refresh and try again." };
  }

  let dream_filters: Record<string, unknown> = {};
  if (dream_filters_raw) {
    try {
      dream_filters = JSON.parse(dream_filters_raw) as Record<string, unknown>;
    } catch {
      dream_filters = {};
    }
  }

  const shortlist_mls_ids = shortlist_raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "This form is not configured yet. Please try again later or call Eric directly.",
    };
  }

  const { error } = await supabase.from("listing_inquiries").insert({
    full_name,
    email,
    phone,
    message: message || dream_brief,
    preferred_times: "",
    listing_source: "",
    listing_id: "",
    listing_title: "Dream home preference brief",
    listing_path: "/listings",
    dream_brief,
    dream_filters,
    shortlist_mls_ids,
  });

  if (error) {
    console.error("submitDreamPreferenceBrief", error.message);
    // Columns may not exist yet — retry without dream columns.
    if (/dream_brief|dream_filters|shortlist/i.test(error.message)) {
      const retry = await supabase.from("listing_inquiries").insert({
        full_name,
        email,
        phone,
        message: [dream_brief, message].filter(Boolean).join("\n\n"),
        preferred_times: "",
        listing_source: "",
        listing_id: shortlist_mls_ids[0] ?? "",
        listing_title: "Dream home preference brief",
        listing_path: "/listings",
      });
      if (retry.error) {
        console.error("submitDreamPreferenceBrief retry", retry.error.message);
        return { ok: false, message: "Something went wrong. Please try again." };
      }
      return { ok: true };
    }
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  return { ok: true };
}
