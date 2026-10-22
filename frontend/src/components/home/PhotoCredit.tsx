/** The small "Designed by Magnific" link under the Magnific photos of a section. Requirements: NFR-13, NFR-10. Spec:
 * specs/2026-10-22-home-photos/requirements.md part 5. 16 px text, a 48 px tap area, a new tab, `rel="noopener noreferrer"`. It sits under the
 * photos, never over a photo or over text. Used once in each section that shows Magnific photos (and, with the same words, by GroupPhoto
 * under each SwiftRescue photo).
 */
import { MAGNIFIC_CREDIT } from "@/config/sectionPhotos";

export function PhotoCredit() {
  return (
    <a
      href={MAGNIFIC_CREDIT.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center self-start text-base font-semibold text-forest underline"
    >
      {MAGNIFIC_CREDIT.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
