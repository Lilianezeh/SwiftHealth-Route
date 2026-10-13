/** The Directions icon: a diamond road sign with a right-turn arrow, drawn in code. Requirements: US-03, FR-10, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D5. The owner approved the drawing (and 24 px on the buttons) on 2026-10-13.
 * It is our own drawing, not Google's icon and not a copy of a lucide icon (lucide-react 1.47.0 has `Diamond` and `CornerUpRight` but
 * no such sign). A rounded diamond outline, then the stem of the arrow, then its head. It is drawn with the current text colour, is
 * 24 x 24 (`h-6 w-6`) and is hidden from screen readers: the word "Directions" next to it carries the meaning.
 */
export function DirectionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-6 w-6 shrink-0"
    >
      <path d="M13.4 2.3 21.7 10.6a1.9 1.9 0 0 1 0 2.8L13.4 21.7a1.9 1.9 0 0 1-2.8 0L2.3 13.4a1.9 1.9 0 0 1 0-2.8L10.6 2.3a1.9 1.9 0 0 1 2.8 0Z" />
      <path d="M9.5 16.5v-4a2.5 2.5 0 0 1 2.5-2.5h3.5" />
      <path d="m13.75 8 2 2-2 2" />
    </svg>
  );
}
