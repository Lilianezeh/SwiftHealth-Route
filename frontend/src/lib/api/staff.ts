/** The staff and admin calls of the API, from the browser. Requirements: FR-30 to FR-32, FR-41, NFR-06. Contract: api-spec, sections
 * 4, 5, 9 and 11. Every call but the two login steps carries the staff token in the header (never in an address). The API reads the
 * role from the database, so a call that the role may not make answers 403.
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type {
  AdminUserChanges,
  AdminUserInput,
  AdminUserList,
  CheckInput,
  CheckList,
  CheckRead,
  ListingInput,
  LoginStarted,
  StaffListingDetail,
  StaffListingList,
  StaffListParams,
  StaffUser,
  TokenResponse,
  UploadSignature,
} from "@/types/staff";

type Options = Omit<RequestOptions, "token" | "body" | "method">;

export function startLogin(email: string, password: string, options: Options = {}): Promise<LoginStarted> {
  return requestJson<LoginStarted>("/auth/login", { ...options, body: { email, password } });
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

export function listAdminUsers(token: string, options: Options = {}): Promise<AdminUserList> {
  return requestJson<AdminUserList>("/admin/users", { ...options, token });
}

export function createAdminUser(token: string, input: AdminUserInput, options: Options = {}): Promise<StaffUser> {
  return requestJson<StaffUser>("/admin/users", { ...options, token, body: input });
}

export function updateAdminUser(token: string, userId: number, changes: AdminUserChanges, options: Options = {}): Promise<StaffUser> {
  return requestJson<StaffUser>(`/admin/users/${userId}`, { ...options, token, method: "PATCH", body: changes });
}
