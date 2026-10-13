/** SwiftRescue, the minimal version. Requirements: FR-14 (112 first and always), FR-26 (what SwiftRescue is and is not), FR-02,
 * NFR-10. UI spec 2.5, "Interim version"; decision 18 in specs/2026-10-11-home-redesign/requirements.md (the owner's addition,
 * with the sources that show 112 is the NCC's national emergency number). A large red button, one line about the full list and
 * the sentence of FR-26, nothing else, until phase 7 replaces the page with the full list, share my location, offline use and
 * the rest. A static page: no data, no request.
 */
import { Phone } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

export default function EmergencyPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">SwiftRescue</h1>
      <a
        href="tel:112"
        className="mt-6 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-xl bg-emergency px-6 text-2xl font-semibold text-white"
      >
        <DecorativeIcon icon={Phone} className="h-7 w-7" />
        Call 112
      </a>
      <p className="mt-6 text-lg text-ink">
        Our full list of verified ambulance, fire and hospital emergency numbers is coming soon.
      </p>
      {/* FR-26: what SwiftRescue is and is not, always in the text of the page. */}
      <p className="mt-6 text-base text-ink-soft">
        SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In
        danger, call 112.
      </p>
    </section>
  );
}
