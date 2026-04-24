import { ogBrandImageResponse } from "@/lib/og-brand-image-response";

export const runtime = "nodejs";

export const alt = "Buy Sell Eric";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return ogBrandImageResponse();
}
