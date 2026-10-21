/** Where each role starts and what it may open in the staff area. UI spec "Phase 10 details"; decision C11 in
 * specs/2026-10-20-staff-screens/requirements.md. This only chooses links: the API checks the role on every request.
 */
import type { StaffRole } from "@/types/staff";

export type StaffArea = "listings" | "staff";

export function homeAddressFor(role: StaffRole): string {
  if (role === "verifier") return "/admin/listings?mine=true";
  if (role === "provider") return "/provider";
  return "/admin/listings";
}

export function canOpen(role: StaffRole, area: StaffArea): boolean {
  if (area === "staff") return role === "admin";
  return role === "verifier" || role === "editor" || role === "admin";
}
