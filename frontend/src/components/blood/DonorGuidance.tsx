/** The donor guidance part of Donate blood. Requirements: FR-29. UI spec 2.7, decision F3 of specs/2026-10-20-blood/.
 * Shows the points of config/donorGuidance.ts with the review line and its date, or says the guidance is being prepared.
 * Always ends with the sentence of FR-29: the blood bank decides. The code writes no medical wording itself.
 */
import { DONOR_GUIDANCE } from "@/config/donorGuidance";
import { formatNoticeDate } from "@/lib/formatters/dates";

export function DonorGuidance() {
  const { points, reviewedBy, reviewedOn } = DONOR_GUIDANCE;
  const isReviewed = points.length > 0 && reviewedOn !== null; // never show guidance without its review line

  return (
    <section aria-labelledby="donor-guidance-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 id="donor-guidance-heading" className="text-xl font-bold text-forest">
        Before you donate
      </h2>
      {isReviewed ? (
        <>
          <ul className="list-disc pl-6 text-base text-ink">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-base text-ink-soft">{`${reviewedBy}, ${formatNoticeDate(reviewedOn)}`}</p>
        </>
      ) : (
        <p className="text-base text-ink">Donor guidance is being prepared with our medical advisor.</p>
      )}
      <p className="text-base font-semibold text-ink">The blood bank will confirm if you can donate.</p>
    </section>
  );
}
