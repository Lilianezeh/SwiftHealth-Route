/** Where each role starts and what it may open in the staff area. UI spec "Phase 10 details"; decision C11 in
 * specs/2026-10-20-staff-screens/requirements.md. This only chooses links: the API checks the role on every request.
 */
import type { StaffRole } from "@/types/staff";

/** "review" is the dashboard, the report queue and the re-checks: the work of an editor (phase 11).
 * "provider" is a provider's own facility, its edit page and its payments (phase 12). */
export type StaffArea = "listings" | "staff" | "review" | "provider" | "security" | "account";

/** Where a role starts: the dashboard for an editor and an admin, their own drafts for a verifier. */
export function homeAddressFor(role: StaffRole): string {
  if (role === "verifier") return "/admin/listings?mine=true";
  if (role === "provider") return "/provider";
  return "/admin";
}

/** The one address a provider may be sent back to after logging in (the "List your facility" page sends them to the login with it
 * as `next`). Anything else in `next` is ignored, so the login can never be turned into a redirect to another place. */
export const LIST_YOUR_FACILITY_ADDRESS = "/list-your-facility";

/** Where a person goes right after logging in: back to "List your facility" if a provider came from there, else their home. */
export function addressAfterLogin(role: StaffRole, search: string): string {
  const next = new URLSearchParams(search).get("next");
  return role === "provider" && next === LIST_YOUR_FACILITY_ADDRESS ? next : homeAddressFor(role);
}

export function canOpen(role: StaffRole, area: StaffArea): boolean {
  if (area === "security") return true; // every account can switch the authenticator app on (FR-58)
  if (area === "account") return true; // every account can change its own details (FR-54)
  if (area === "staff") return role === "admin";
  if (area === "review") return role === "editor" || role === "admin";
  if (area === "provider") return role === "provider";
  return role === "verifier" || role === "editor" || role === "admin";
}

/** The shortest password for a role (FR-56): 8 for a provider, 10 for staff and admin. The API checks it too, and also refuses very common passwords. */
export function minPasswordLength(role: StaffRole): number {
  return role === "provider" ? 8 : 10;
}
