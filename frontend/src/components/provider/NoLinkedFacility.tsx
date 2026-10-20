/** What every provider screen says when no listing is linked to the account (answer 404). Requirements: FR-43. UI spec 4.1 and
 * "Phase 12 details". An admin links a provider to a listing in the staff accounts screen.
 */
export function NoLinkedFacility() {
  return (
    <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
      No facility is linked to your account yet. Ask the SwiftHealth team to link it.
    </p>
  );
}
