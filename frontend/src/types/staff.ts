/** Types for the staff screens. Must match specs/backend/api-spec.md, sections 4, 5, 9 and 11 and the phase 10 clarifications. */
import type { ListingDetail, ListingSummary } from "@/types/api";

export type StaffRole = "verifier" | "editor" | "admin" | "provider";
export type ListingStatus = "draft" | "pending_review" | "published" | "recheck_due" | "hidden";

/** `UserRead`: never holds a password. */
export type StaffUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null; // +234...
  role: StaffRole;
  is_active: boolean;
};

export type StaffSession = { token: string; user: StaffUser };

export type LoginStarted = { challenge_token: string; sent_to: string }; // sent_to is masked: +234******0001
export type TokenResponse = { access_token: string; token_type: string; expires_in: number; user: StaffUser };

export type StaffListingSummary = ListingSummary & {
  status: ListingStatus;
  next_check_due: string | null;
  created_by: number | null;
};
export type StaffListingList = { items: StaffListingSummary[]; total: number };

export type StaffListingDetail = ListingDetail & {
  status: ListingStatus;
  next_check_due: string | null;
  owner_id: number | null;
  created_by: number | null;
  featured_until: string | null;
  map_pin_is_default: boolean;
  submission_details: string | null;
};

export type StaffListParams = {
  status?: ListingStatus;
  category?: string;
  area?: string;
  q?: string;
  mine?: boolean;
  limit?: number;
  offset?: number;
};

export type PhoneInput = { number: string; label: string | null; is_primary: boolean; is_whatsapp: boolean };
export type HoursInput = { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean };
export type ServiceInput = {
  name: string;
  fee_min_naira: string | null; // "1500.00", never a number
  fee_max_naira: string | null;
  fee_collected_at: string | null; // "YYYY-MM-DD"
};

/** The body of POST /listings; PATCH takes any of these. */
export type ListingInput = {
  name: string;
  category: string; // slug
  area: string;
  address: string;
  landmark: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  is_24_hours: boolean;
  phones: PhoneInput[];
  opening_hours: HoursInput[];
  services: ServiceInput[];
};

export type CheckMethod = "call" | "visit";
export type CheckResult = "pass" | "fail";
export type CheckInput = {
  method: CheckMethod;
  result: CheckResult;
  person_reached: string | null;
  notes: string | null;
  photo_url: string | null;
};
export type CheckRead = {
  id: number;
  method: CheckMethod;
  result: CheckResult;
  person_reached: string | null;
  notes: string | null;
  photo_url: string | null;
  checked_at: string;
  staff_id: number;
  staff_name: string;
};
export type CheckList = { items: CheckRead[]; total: number };

export type UploadSignature = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  upload_preset: string | null;
};

export type AdminUserInput = { name: string; email: string; phone: string; role: StaffRole; password: string };
export type AdminUserChanges = {
  name?: string;
  phone?: string;
  role?: StaffRole;
  is_active?: boolean;
  password?: string;
  listing_id?: number;
};
export type AdminUserList = { items: StaffUser[]; total: number };
