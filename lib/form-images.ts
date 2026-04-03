export function canPreviewImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t) {
    return false;
  }
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Collect listing image URLs from admin form (repeated `image_url` fields or legacy textarea). */
export function parseListingImageUrlsFromForm(formData: FormData): string[] {
  const fromList = formData.getAll("image_url");
  if (fromList.length > 0) {
    return fromList
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(formData.get("image_urls") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
