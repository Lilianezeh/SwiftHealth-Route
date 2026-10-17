/** The 112 card of SwiftRescue. Requirements: FR-14 (112 first and always), FR-26, NFR-03, NFR-10. UI spec 2.5, points 1 and 2.
 * A server component with no data: it is in the page's own HTML, so it shows before any request and with no network. 112 is the
 * NCC's national emergency number (sources: specs/2026-10-11-home-redesign/requirements.md, decision 18).
 */
import { Phone } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

export function NationalLineCard() {
  return (
    <section aria-labelledby="national-line-heading" className="rounded-2xl border-2 border-emergency bg-white p-4">
      <h2 id="national-line-heading" className="text-xl font-bold text-ink">
        National emergency number — 112
      </h2>
      <a
        href="tel:112"
        className="mt-4 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-emergency px-6 text-2xl font-semibold text-white"
      >
        <DecorativeIcon icon={Phone} className="h-7 w-7" />
        Call 112
      </a>
      {/* FR-26: what SwiftRescue is and is not, always in the text of the page. */}
      <p className="mt-4 text-base text-ink-soft">
        SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In
        danger, call 112.
      </p>
    </section>
  );
}
