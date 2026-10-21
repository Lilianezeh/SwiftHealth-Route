/** Types for the staff screens. Must match specs/backend/api-spec.md, sections 4, 5, 9 and 11 and the phase 10 clarifications. */
import type { ReportReason } from "@/config/reports";
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
  due?: DueFilter;
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

export type DueFilter = "overdue" | "this_week";

/** The answer of GET and PATCH /provider/listing: the staff detail of the provider's own listing and the monthly price. */
export type ProviderListing = StaffListingDetail & { featured_price_naira: string }; // "5000.00"

/** The answer of POST /payments/featured: where to pay, on Paystack's page, and the price. */
export type FeaturedStarted = { authorization_url: string; reference: string; amount_naira: string };

/** The answer of GET /payments/verify/{reference}: `success` once the signed webhook has been applied. */
export type PaymentVerified = { status: "success" | "pending"; featured_until: string | null };

export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportListingRef = { id: number; slug: string; name: string; area: string; status: ListingStatus };
/** One report of the staff queue (api-spec, "Phase 11 rules" under section 6). */
export type ReportItem = {
  id: number;
  listing: ReportListingRef;
  reason: ReportReason;
  comment: string | null;
  reporter_phone: string | null; // masked: +234******0000
  created_at: string;
  status: ReportStatus;
  urgent: boolean;
  resolved_at: string | null;
};
export type ReportList = { items: ReportItem[]; total: number };

/** The answer of GET /dashboard/stats (api-spec, section 10). */
export type DashboardStats = {
  listings_by_status: Record<ListingStatus, number>;
  rechecks_due_this_week: number;
  overdue_rechecks: number;
  open_reports: number;
  urgent_reports: number;
  checks_last_30_days: { date: string; passed: number; failed: number }[]; // one per Lagos day, oldest first
  featured_active: number;
};
