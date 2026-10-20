/** Where each role starts and what it may open in the staff area. UI spec "Phase 10 details"; decision C11 in
 * specs/2026-10-20-staff-screens/requirements.md. This only chooses links: the API checks the role on every request.
 */
import type { StaffRole } from "@/types/staff";

/** "review" is the dashboard, the report queue and the re-checks: the work of an editor (phase 11).
 * "provider" is a provider's own facility, its edit page and its payments (phase 12). */
export type StaffArea = "listings" | "staff" | "review" | "provider";

/** Where a role starts: the dashboard for an editor and an admin, their own drafts for a verifier. */
export function homeAddressFor(role: StaffRole): string {
  if (role === "verifier") return "/admin/listings?mine=true";
  if (role === "provider") return "/provider";
  return "/admin";
}

export function canOpen(role: StaffRole, area: StaffArea): boolean {
  if (area === "staff") return role === "admin";
  if (area === "review") return role === "editor" || role === "admin";
  if (area === "provider") return role === "provider";
  return role === "verifier" || role === "editor" || role === "admin";
}
