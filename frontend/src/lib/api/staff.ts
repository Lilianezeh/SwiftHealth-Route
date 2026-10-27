/** The staff and admin calls of the API, from the browser. Requirements: FR-30 to FR-32, FR-41, NFR-06. Contract: api-spec, sections
 * 4, 5, 9 and 11. Every call but the two login steps carries the staff token in the header (never in an address). The API reads the
 * role from the database, so a call that the role may not make answers 403.
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type {
  ActivityList,
  ActivityQuery,
  AdminUserChanges,
  AdminUserInput,
  AdminUserList,
  AdminUserQuery,
  AdminUserRow,
  BackupCodes,
  CheckInput,
  CheckList,
  CheckRead,
  DashboardStats,
  EmergencyContactGroups,
  ListingInput,
  LoginStarted,
  OwnerRequestList,
  ReportItem,
  ReportList,
  ReportStatus,
  StaffListingDetail,
  StaffListingList,
  StaffListParams,
  StaffUser,
  TokenResponse,
  TwoFactorSetupStart,
  TwoFactorStatus,
  UploadSignature,
} from "@/types/staff";

type Options = Omit<RequestOptions, "token" | "body" | "method">;

export function startLogin(email: string, password: string, options: Options = {}): Promise<LoginStarted> {
  return requestJson<LoginStarted>("/auth/login", { ...options, body: { email, password } });
}

/** With the app switched on: an SMS code instead, when the server says SMS is possible (FR-58). */
export function askForSmsInstead(challengeToken: string, options: Options = {}): Promise<LoginStarted> {
  return requestJson<LoginStarted>("/auth/use-sms", { ...options, body: { challenge_token: challengeToken } });
}

/** The authenticator app of the logged-in person (FR-58). The password and the code go in the body, never in an address. */
export function getTwoFactorStatus(token: string, options: Options = {}): Promise<TwoFactorStatus> {
  return requestJson<TwoFactorStatus>("/account/two-factor", { ...options, token });
}

export function startTwoFactorSetup(token: string, password: string, options: Options = {}): Promise<TwoFactorSetupStart> {
  return requestJson<TwoFactorSetupStart>("/account/two-factor/start", { ...options, token, body: { password } });
}

export function confirmTwoFactorSetup(token: string, code: string, options: Options = {}): Promise<BackupCodes> {
  return requestJson<BackupCodes>("/account/two-factor/confirm", { ...options, token, body: { code } });
}

export function disableTwoFactor(token: string, password: string, code: string, options: Options = {}): Promise<{ enabled: boolean }> {
  return requestJson<{ enabled: boolean }>("/account/two-factor/disable", { ...options, token, body: { password, code } });
}

export function renewBackupCodes(token: string, password: string, code: string, options: Options = {}): Promise<BackupCodes> {
  return requestJson<BackupCodes>("/account/two-factor/backup-codes", { ...options, token, body: { password, code } });
}

/** A new login code for the current challenge token: the password is not sent again (FR-57). */
export function resendLoginCode(challengeToken: string, options: Options = {}): Promise<LoginStarted> {
  return requestJson<LoginStarted>("/auth/resend-code", { ...options, body: { challenge_token: challengeToken } });
}

export function verifyLoginCode(challengeToken: string, code: string, options: Options = {}): Promise<TokenResponse> {
  return requestJson<TokenResponse>("/auth/verify-code", { ...options, body: { challenge_token: challengeToken, code } });
}

export function listStaffListings(token: string, params: StaffListParams, options: Options = {}): Promise<StaffListingList> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("category", params.category);
  if (params.area) query.set("area", params.area);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.mine) query.set("mine", "true");
  if (params.due) query.set("due", params.due);
  query.set("limit", String(params.limit ?? 20));
  query.set("offset", String(params.offset ?? 0));
  return requestJson<StaffListingList>(`/listings?${query.toString()}`, { ...options, token });
}

export function getStaffListing(token: string, listingId: number, options: Options = {}): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>(`/listings/id/${listingId}`, { ...options, token });
}

export function createListing(token: string, input: ListingInput, options: Options = {}): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>("/listings", { ...options, token, body: input });
}

export function updateListing(
  token: string,
  listingId: number,
  changes: Partial<ListingInput>,
  options: Options = {},
): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>(`/listings/${listingId}`, { ...options, token, method: "PATCH", body: changes });
}

export type ListingMove = "submit" | "publish" | "reopen";

/** The contacts of every SwiftRescue group, of every status (editor and admin). Adding and editing use the listing calls. */
export function listEmergencyContacts(token: string, options: Options = {}): Promise<EmergencyContactGroups> {
  return requestJson<EmergencyContactGroups>("/staff/emergency-contacts", { ...options, token });
}

export function moveListing(token: string, listingId: number, move: ListingMove, options: Options = {}): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>(`/listings/${listingId}/${move}`, { ...options, token, method: "POST" });
}

export function hideListing(token: string, listingId: number, reason: string, options: Options = {}): Promise<StaffListingDetail> {
  return requestJson<StaffListingDetail>(`/listings/${listingId}/hide`, { ...options, token, body: { reason } });
}

export function listChecks(token: string, listingId: number, options: Options = {}): Promise<CheckList> {
  return requestJson<CheckList>(`/listings/${listingId}/checks`, { ...options, token });
}

export function logCheck(token: string, listingId: number, input: CheckInput, options: Options = {}): Promise<CheckRead> {
  return requestJson<CheckRead>(`/listings/${listingId}/checks`, { ...options, token, body: input });
}

export function signUpload(token: string, options: Options = {}): Promise<UploadSignature> {
  return requestJson<UploadSignature>("/uploads/sign", { ...options, token, body: { folder: "entrances" } });
}

/** The accounts that match the filters, one page. Only the filters that were given are sent; with none, the API's own page of 100. */
export function listAdminUsers(token: string, query: AdminUserQuery = {}, options: Options = {}): Promise<AdminUserList> {
  const parameters = new URLSearchParams();
  if (query.role) parameters.set("role", query.role);
  if (query.approval_status) parameters.set("approval_status", query.approval_status);
  if (query.is_active !== undefined) parameters.set("is_active", String(query.is_active));
  if (query.q?.trim()) parameters.set("q", query.q.trim());
  if (query.limit !== undefined) parameters.set("limit", String(query.limit));
  if (query.offset) parameters.set("offset", String(query.offset));
  const text = parameters.toString();
  return requestJson<AdminUserList>(`/admin/users${text ? `?${text}` : ""}`, { ...options, token });
}

/** Approve a staff sign-up as an editor or a verifier (never an admin or a provider). */
export function approveAdminUser(token: string, userId: number, role: "editor" | "verifier", options: Options = {}): Promise<AdminUserRow> {
  return requestJson<AdminUserRow>(`/admin/users/${userId}/approve`, { ...options, token, body: { role } });
}

/** Reject a staff sign-up; the reason is optional and goes in the body, never in the address. */
export function rejectAdminUser(token: string, userId: number, reason?: string, options: Options = {}): Promise<AdminUserRow> {
  return requestJson<AdminUserRow>(`/admin/users/${userId}/reject`, { ...options, token, body: reason ? { reason } : {} });
}

export function suspendAdminUser(token: string, userId: number, reason: string, options: Options = {}): Promise<AdminUserRow> {
  return requestJson<AdminUserRow>(`/admin/users/${userId}/suspend`, { ...options, token, body: { reason } });
}

export function reactivateAdminUser(token: string, userId: number, options: Options = {}): Promise<AdminUserRow> {
  return requestJson<AdminUserRow>(`/admin/users/${userId}/reactivate`, { ...options, token, method: "POST" });
}

/** The admin phoned the person and the phone is theirs (used while Termii is off, decision D20). */
export function confirmPhoneByCall(token: string, userId: number, options: Options = {}): Promise<{ phone_confirmed: boolean }> {
  return requestJson<{ phone_confirmed: boolean }>(`/admin/users/${userId}/confirm-phone-by-call`, { ...options, token, method: "POST" });
}

/** The owner requests that wait for a phone call (accounts phase 6). */
export function listOwnerRequests(token: string, options: Options = {}): Promise<OwnerRequestList> {
  return requestJson<OwnerRequestList>("/staff/owner-requests", { ...options, token });
}

/** Approve after phoning the facility; the note (who was reached) is needed and goes in the body. */
export function approveOwnerRequest(token: string, requestId: number, note: string, options: Options = {}): Promise<unknown> {
  return requestJson<unknown>(`/staff/owner-requests/${requestId}/approve`, { ...options, token, body: { note } });
}

export function rejectOwnerRequest(token: string, requestId: number, note?: string, options: Options = {}): Promise<unknown> {
  return requestJson<unknown>(`/staff/owner-requests/${requestId}/reject`, { ...options, token, body: note ? { note } : {} });
}

/** The activity log, newest first. Only the filters that were given are sent. */
export function listActivity(token: string, query: ActivityQuery = {}, options: Options = {}): Promise<ActivityList> {
  const parameters = new URLSearchParams();
  if (query.user_id !== undefined) parameters.set("user_id", String(query.user_id));
  if (query.action) parameters.set("action", query.action);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);
  if (query.limit !== undefined) parameters.set("limit", String(query.limit));
  if (query.offset) parameters.set("offset", String(query.offset));
  const text = parameters.toString();
  return requestJson<ActivityList>(`/admin/activity${text ? `?${text}` : ""}`, { ...options, token });
}

export function createAdminUser(token: string, input: AdminUserInput, options: Options = {}): Promise<StaffUser> {
  return requestJson<StaffUser>("/admin/users", { ...options, token, body: input });
}

export function updateAdminUser(token: string, userId: number, changes: AdminUserChanges, options: Options = {}): Promise<StaffUser> {
  return requestJson<StaffUser>(`/admin/users/${userId}`, { ...options, token, method: "PATCH", body: changes });
}

/** GET /reports: the staff queue, urgent first (FR-35). */
export function listReports(
  token: string,
  status: ReportStatus,
  page: { limit: number; offset: number },
  options: Options = {},
): Promise<ReportList> {
  const query = new URLSearchParams({ status, limit: String(page.limit), offset: String(page.offset) });
  return requestJson<ReportList>(`/reports?${query.toString()}`, { ...options, token });
}

/** PATCH /reports/{id}: resolve or dismiss. The API deletes the reporter's phone when it closes the report. */
export function closeReport(
  token: string,
  reportId: number,
  status: "resolved" | "dismissed",
  options: Options = {},
): Promise<ReportItem> {
  return requestJson<ReportItem>(`/reports/${reportId}`, { ...options, token, method: "PATCH", body: { status } });
}

/** GET /dashboard/stats: every number of the dashboard in one call (FR-34). */
export function getDashboardStats(token: string, options: Options = {}): Promise<DashboardStats> {
  return requestJson<DashboardStats>("/dashboard/stats", { ...options, token });
}

export type ImportResult ={ created: number; errors: { row: number; detail: string }[] };

/** POST /admin/import: the text of the CSV file as the request body (decision E1 in specs/2026-10-20-launch-readiness/). */
export function importListingsCsv(token: string, csvText: string, options: Options = {}): Promise<ImportResult> {
  return requestJson<ImportResult>("/admin/import", { ...options, token, csvBody: csvText });
}

/** GET /admin/export?type=...: the CSV as text, for the browser to save as a file. */
export function exportCsv(token: string, type: "listings" | "checks", options: Options = {}): Promise<string> {
  return requestJson<string>(`/admin/export?type=${type}`, { ...options, token, asText: true });
}
