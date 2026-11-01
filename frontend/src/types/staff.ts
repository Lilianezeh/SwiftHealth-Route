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
  two_factor_enabled?: boolean; // the authenticator app is switched on (FR-58); absent in a session saved before it existed
};

/** `idle_seconds` is how long the account may be idle (`expires_in` of the login or the last renewal); absent in a session saved
 * before the automatic sign-out existed (the page then uses the default of the role, config/idle.ts). */
export type StaffSession = { token: string; user: StaffUser; idle_seconds?: number };

/** What the second login step asks for: a code that was sent by SMS or email, or a code from the authenticator app (FR-58). */
export type LoginMethod = "sms" | "email" | "totp";
/** `sent_to` is masked: +234******0001 (sms), a***@example.com (email), null (totp: nothing is sent). */
export type LoginStarted = { challenge_token: string; sent_to: string | null; method: LoginMethod; can_use_sms: boolean };

/** The authenticator app of the logged-in person. `available` is false when the server has no usable encryption key. */
export type TwoFactorStatus = { enabled: boolean; backup_codes_left: number; available: boolean };
export type TwoFactorSetupStart = { secret: string; otpauth_uri: string };
export type BackupCodes = { backup_codes: string[] };
export type TokenResponse = { access_token: string; token_type: string; expires_in: number; user: StaffUser };
/** POST /auth/keep-alive: a new token for the same session. */
export type TokenRefreshed = { access_token: string; token_type: string; expires_in: number };

export type StaffListingSummary = ListingSummary & {
  status: ListingStatus;
  next_check_due: string | null;
  created_by: number | null;
};
export type StaffListingList = { items: StaffListingSummary[]; total: number };

/** GET /staff/emergency-contacts: the nine SwiftRescue groups in the page's order, each with its contacts of every status. */
export type EmergencyContactGroups = {
  groups: { category: { slug: string; name: string }; contacts: StaffListingSummary[]; total: number }[];
};

export type StaffListingDetail = ListingDetail & {
  status: ListingStatus;
  next_check_due: string | null;
  owner_id: number | null;
  created_by: number | null;
  featured_until: string | null;
  map_pin_is_default: boolean;
  submission_details: string | null;
  closed_at: string | null; // set when the facility was closed (accounts phase 8a)
  closed_reason: string | null;
  parent_id?: number | null; // the main facility this listing is a branch of (accounts phase 8b)
  parent_name?: string | null;
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
/** An account in the admin's list (api-spec section 11, "Phase 4a"): the usual user plus what the admin needs to decide.
 * Never a password, a hash, a code or the authenticator secret. */
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AdminUserRow = StaffUser & {
  approval_status: ApprovalStatus;
  last_login_at: string | null;
  created_at: string;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  signup_note: string | null; // what a staff sign-up wrote about themselves
};
export type AdminUserList = { items: AdminUserRow[]; total: number }; // `total` counts every match, not only this page
export type AdminUserQuery = {
  role?: StaffRole;
  approval_status?: ApprovalStatus;
  is_active?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
};

/** One of a provider's own facility links (GET /provider/listings, accounts phase 6). */
export type MyFacility = {
  link_id: number;
  listing_id: number;
  name: string;
  area: string;
  category: { slug: string; name: string };
  role: "owner" | "manager";
  status: "awaiting_payment" | "pending" | "approved" | "lapsed" | "ending" | "removed";
  requested_at: string;
  // The owner fee (specs/2026-10-29-owner-fee/): the end of the paid month, and where the link is in its life.
  paid_until: string | null;
  fee_state: FeeState;
};

export type FeeState = "awaiting_payment" | "waiting_for_staff" | "paid" | "grace" | "lapsed" | "ending" | "ended" | "removed";

/** GET /provider/listings: the links, the monthly fee ("10000.00") and the grace days after a paid month. */
export type MyFacilityList = { fee_naira: string; grace_days: number; items: MyFacility[] };

/** POST /payments/owner-fee: where to pay on Paystack's own page (test mode). */
export type OwnerFeeStarted = { authorization_url: string; reference: string; amount_naira: string };
/** GET /payments/owner-fee/{reference}: "success" only after the signed webhook was applied. */
export type OwnerFeeVerified = { status: "success" | "pending"; link_status: MyFacility["status"]; paid_until: string | null };
/** One receipt: GET /provider/payments. */
export type OwnerFeePayment = {
  reference: string;
  kind: "owner_fee";
  listing_id: number;
  listing_name: string;
  paid_at: string;
  paid_until: string | null;
};
/** POST /provider/links/{id}/cancel. */
export type LinkCancelled = { link_id: number; status: MyFacility["status"]; access_until: string | null; refund: "done" | "pending" | null };

/** A request that waits for staff to phone the facility (GET /staff/owner-requests). */
export type OwnerRequest = {
  id: number;
  role: "owner" | "manager";
  requested_at: string;
  reason: string | null; // the person's own words, when they gave some (a claim or a new facility's notes)
  person: { id: number; name: string; email: string; phone: string | null };
  listing: { id: number; name: string; area: string; phones: { number: string; label: string | null; is_primary: boolean }[] };
};
export type OwnerRequestList = { items: OwnerRequest[]; total: number };

/** One entry of the activity log (GET /admin/activity). The Paystack reference column is never sent. */
export type ActivityItem = {
  id: number;
  at: string;
  user_id: number | null;
  user_name: string | null; // null: the nightly job or an anonymous submission
  action: string;
  listing_id: number | null;
  listing_name: string | null;
  target_user_id: number | null; // the account a decision was about
  target_user_name: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
};
export type ActivityList = { items: ActivityItem[]; total: number };
export type ActivityQuery = {
  user_id?: number;
  action?: string;
  from?: string; // YYYY-MM-DD, included
  to?: string; // YYYY-MM-DD, included
  limit?: number;
  offset?: number;
};

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
