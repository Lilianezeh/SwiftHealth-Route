/** The donor guidance of the Donate blood page. Requirements: FR-29. Decision F3 in specs/2026-10-20-blood/requirements.md.
 *
 * It is empty on purpose: the guidance is medical wording, so the owner's medical advisor writes and approves it (CLAUDE.md:
 * no medical advice written by the code). Until then the page says the guidance is being prepared.
 * To add it: put each point in `points`, keep `reviewedBy` as it is, and set `reviewedOn` to the date the advisor approved
 * the text ("YYYY-MM-DD"). A test fails if points are added without the review line and the date.
 */
export const DONOR_GUIDANCE: { points: string[]; reviewedBy: string; reviewedOn: string | null } = {
  points: [],
  reviewedBy: "Reviewed by our medical advisor",
  reviewedOn: null,
};
