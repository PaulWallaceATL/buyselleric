"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellFormState = { ok: true } | { ok: false; message: string } | null;

export async function submitSellInquiry(
  _prev: SellFormState,
  formData: FormData
): Promise<SellFormState> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const property_address = String(formData.get("property_address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postal_code = String(formData.get("postal_code") ?? "").trim();
  const property_type = String(formData.get("property_type") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!full_name || !email) {
    return { ok: false, message: "Name and email are required." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "This form is not configured yet. Please try again later or call Eric directly.",
    };
  }

  const { error } = await supabase.from("sell_submissions").insert({
    full_name,
    email,
    phone,
    property_address,
    city,
    state,
    postal_code,
    property_type,
    timeline,
    message,
  });

  if (error) {
    console.error("submitSellInquiry", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  return { ok: true };
}
