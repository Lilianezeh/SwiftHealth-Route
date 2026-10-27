/** The words of the admin's account screens, in one place. Requirements: FR-49, FR-55, NFR-10. UI spec 3.8 (accounts phase 4b).
 * Plain sentences for a person who is not technical; the API's own sentence is shown whenever it sent one.
 */
import { ApiError } from "@/lib/api/request";
import { formatLagosDateTime } from "@/lib/formatters/dates";
import type { AdminUserRow, StaffRole } from "@/types/staff";

export const ROLE_LABELS: Record<StaffRole, string> = { verifier: "Verifier", editor: "Editor", admin: "Admin", provider: "Provider" };

/** An account in words: waiting, not approved, suspended or active. An answer from an older API with no approval state counts as approved. */
export function stateWords(user: Pick<AdminUserRow, "approval_status" | "is_active">): string {
  if (user.approval_status === "pending") return "Waiting for approval";
  if (user.approval_status === "rejected") return "Not approved";
  return user.is_active ? "Active" : "Suspended";
}

export function lastLoginWords(user: Pick<AdminUserRow, "last_login_at">): string {
  return user.last_login_at ? `Last login: ${formatLagosDateTime(user.last_login_at)}` : "Has not logged in yet";
}

/** The API's own sentence when it sent one, else plain words (a 422 means a field looked wrong; anything else a bad connection). */
export function sentenceFor(error: unknown): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  if (error instanceof ApiError && error.status === 422) {
    return "Check the fields: the phone must look like 0803 123 4567 and the email must be an email address.";
  }
  return "We couldn't do that. Check your connection and try again.";
}

/** "a verifier", "an editor": for the sentences that say what an account was approved as. */
export function withArticle(role: "editor" | "verifier"): string {
  return role === "editor" ? "an editor" : "a verifier";
}

/** The words for an action of the activity log; an action with no wording shows its code with the underscores as spaces. */
const ACTION_WORDS: Record<string, string> = {
  user_approve: "approved an account",
  user_reject: "rejected an account",
  user_suspend: "suspended an account",
  user_reactivate: "reactivated an account",
  phone_confirmed_by_call: "recorded a phone call that confirmed a phone",
  user_create: "added an account",
  user_update: "changed an account",
  signup_confirmed: "finished signing up",
  two_factor_reset: "reset a two-step login",
  owner_request: "asked to manage a facility",
  owner_approve: "approved a request to manage a facility",
  owner_reject: "rejected a request to manage a facility",
  owner_remove: "removed someone's access to a facility",
  create: "created a listing",
  update: "changed a listing",
  publish: "published a listing",
  hide: "hid a listing",
  payment: "received a payment",
};

export function actionWords(action: string): string {
  return ACTION_WORDS[action] ?? action.replace(/_/g, " ");
}

/** The choices of the "What happened" filter: the action code the API wants, and the words the admin reads. */
export const ACTION_CHOICES: { value: string; label: string }[] = [
  { value: "user_approve", label: "Account approved" },
  { value: "user_reject", label: "Account rejected" },
  { value: "user_suspend", label: "Account suspended" },
  { value: "user_reactivate", label: "Account reactivated" },
  { value: "phone_confirmed_by_call", label: "Phone confirmed by call" },
  { value: "user_create", label: "Account added" },
  { value: "user_update", label: "Account changed" },
  { value: "signup_confirmed", label: "Sign-up confirmed" },
  { value: "owner_request", label: "Facility request" },
  { value: "owner_approve", label: "Facility request approved" },
  { value: "owner_reject", label: "Facility request rejected" },
  { value: "owner_remove", label: "Facility access removed" },
  { value: "create", label: "Listing created" },
  { value: "update", label: "Listing changed" },
  { value: "payment", label: "Payment" },
];
