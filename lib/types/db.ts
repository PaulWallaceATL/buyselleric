export type ListingStatus = "draft" | "available" | "pending" | "sold";

export type SellSubmissionAdminStatus = "new" | "in_progress" | "closed";

export interface ListingRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  is_published: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface SellSubmissionRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  property_address: string;
  city: string;
  state: string;
  postal_code: string;
  property_type: string;
  timeline: string;
  message: string;
  admin_status: SellSubmissionAdminStatus;
  created_at: string;
}
