"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { parseListingImageUrlsFromForm } from "@/lib/form-images";
import { slugify } from "@/lib/format";
import {
  adminGetListing,
  adminListListings,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import type { ListingStatus, SellSubmissionAdminStatus } from "@/lib/types/db";

export type AdminListingFormState = { ok: false; message: string } | null;

export async function adminSaveListing(
  prev: AdminListingFormState,
  formData: FormData
): Promise<AdminListingFormState> {
  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (listingId) {
    return adminUpdateListing(listingId, prev, formData);
  }
  return adminCreateListing(prev, formData);
}

async function requireAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    throw new Error("Unauthorized");
  }
}

export async function adminCreateListing(
  _prev: AdminListingFormState,
  formData: FormData
): Promise<AdminListingFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const title = String(formData.get("title") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_usd") ?? "").trim();
  const bedrooms = Number.parseInt(String(formData.get("bedrooms") ?? "0"), 10);
  const bathrooms = Number.parseFloat(String(formData.get("bathrooms") ?? "0"));
  const square_feetRaw = String(formData.get("square_feet") ?? "").trim();
  const address_line = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postal_code = String(formData.get("postal_code") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as ListingStatus;
  const is_published = formData.get("is_published") === "on";
  const imageLines = parseListingImageUrlsFromForm(formData);

  if (!title) {
    return { ok: false, message: "Title is required." };
  }

  const price_cents = Math.round(Number.parseFloat(priceRaw.replace(/[^0-9.]/g, "")) * 100);
  if (!Number.isFinite(price_cents) || price_cents < 0) {
    return { ok: false, message: "Enter a valid price." };
  }

  if (!slug) {
    slug = slugify(title);
  }

  const square_feet =
    square_feetRaw === "" ? null : Number.parseInt(square_feetRaw, 10);
  if (square_feet !== null && (Number.isNaN(square_feet) || square_feet < 0)) {
    return { ok: false, message: "Square feet must be a positive number." };
  }

  const allowed: ListingStatus[] = ["draft", "available", "pending", "sold"];
  const safeStatus = allowed.includes(status) ? status : "draft";

  let finalSlug = slug;
  const existing = await adminListListings(client);
  const slugs = new Set(existing.map((l) => l.slug));
  let n = 0;
  while (slugs.has(finalSlug)) {
    n += 1;
    finalSlug = `${slug}-${n}`;
  }

  const { error } = await client.from("listings").insert({
    slug: finalSlug,
    title,
    description,
    price_cents,
    bedrooms: Number.isNaN(bedrooms) ? 0 : Math.max(0, bedrooms),
    bathrooms: Number.isNaN(bathrooms) ? 0 : Math.max(0, bathrooms),
    square_feet,
    address_line,
    city,
    state,
    postal_code,
    status: safeStatus,
    is_published,
    image_urls: imageLines,
  });

  if (error) {
    console.error("adminCreateListing", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath("/admin/listings");
  redirect("/admin/listings");
}

export async function adminUpdateListing(
  id: string,
  _prev: AdminListingFormState,
  formData: FormData
): Promise<AdminListingFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const current = await adminGetListing(client, id);
  if (!current) {
    return { ok: false, message: "Listing not found." };
  }

  const title = String(formData.get("title") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_usd") ?? "").trim();
  const bedrooms = Number.parseInt(String(formData.get("bedrooms") ?? "0"), 10);
  const bathrooms = Number.parseFloat(String(formData.get("bathrooms") ?? "0"));
  const square_feetRaw = String(formData.get("square_feet") ?? "").trim();
  const address_line = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postal_code = String(formData.get("postal_code") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as ListingStatus;
  const is_published = formData.get("is_published") === "on";
  const imageLines = parseListingImageUrlsFromForm(formData);

  if (!title) {
    return { ok: false, message: "Title is required." };
  }

  const price_cents = Math.round(Number.parseFloat(priceRaw.replace(/[^0-9.]/g, "")) * 100);
  if (!Number.isFinite(price_cents) || price_cents < 0) {
    return { ok: false, message: "Enter a valid price." };
  }

  if (!slug) {
    slug = slugify(title);
  }

  const square_feet =
    square_feetRaw === "" ? null : Number.parseInt(square_feetRaw, 10);
  if (square_feet !== null && (Number.isNaN(square_feet) || square_feet < 0)) {
    return { ok: false, message: "Square feet must be a positive number." };
  }

  const allowed: ListingStatus[] = ["draft", "available", "pending", "sold"];
  const safeStatus = allowed.includes(status) ? status : "draft";

  if (slug !== current.slug) {
    const { data: clash } = await client.from("listings").select("id").eq("slug", slug).maybeSingle();
    if (clash && (clash as { id: string }).id !== id) {
      return { ok: false, message: "That slug is already in use." };
    }
  }

  const { error } = await client
    .from("listings")
    .update({
      slug,
      title,
      description,
      price_cents,
      bedrooms: Number.isNaN(bedrooms) ? 0 : Math.max(0, bedrooms),
      bathrooms: Number.isNaN(bathrooms) ? 0 : Math.max(0, bathrooms),
      square_feet,
      address_line,
      city,
      state,
      postal_code,
      status: safeStatus,
      is_published,
      image_urls: imageLines,
    })
    .eq("id", id);

  if (error) {
    console.error("adminUpdateListing", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${current.slug}`);
  revalidatePath(`/listings/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}/edit`);
  redirect("/admin/listings");
}

export async function adminDeleteListingForm(
  _prev: AdminListingFormState,
  formData: FormData
): Promise<AdminListingFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { ok: false, message: "Missing listing id." };
  }
  return adminDeleteListing(id);
}

export async function adminDeleteListing(id: string): Promise<AdminListingFormState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const { error } = await client.from("listings").delete().eq("id", id);
  if (error) {
    console.error("adminDeleteListing", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath("/admin/listings");
  redirect("/admin/listings");
}

export async function adminUpdateSubmissionStatus(
  id: string,
  admin_status: SellSubmissionAdminStatus
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const allowed: SellSubmissionAdminStatus[] = ["new", "in_progress", "closed"];
  const safe = allowed.includes(admin_status) ? admin_status : "new";

  const { error } = await client.from("sell_submissions").update({ admin_status: safe }).eq("id", id);
  if (error) {
    console.error("adminUpdateSubmissionStatus", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  return { ok: true };
}
