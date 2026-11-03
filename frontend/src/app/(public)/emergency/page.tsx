/** SwiftRescue, the emergency section. Requirements: US-04, FR-14 to FR-19, FR-24 to FR-26, NFR-01, NFR-03, NFR-10.
 * UI spec 2.5. Feature: specs/2026-10-17-swiftrescue/; tidied on 2026-11-03 (specs/2026-11-03-emergency-page-tidy/). A static page: 112
 * and the sentence of FR-26 are in the HTML, so they show at once and work offline, then the photo banner. The contacts come from the API in
 * the browser (EmergencyContent).
 */
import type { Metadata } from "next";

import { EmergencyBanner } from "@/components/emergency/EmergencyBanner";
import { EmergencyContent } from "@/components/emergency/EmergencyContent";
import { NationalLineCard } from "@/components/emergency/NationalLineCard";

export const metadata: Metadata = {
  title: "SwiftRescue",
  description: "Emergency contacts in one place, 112 first. SwiftRescue does not dispatch or guarantee an emergency response.",
};

export default function EmergencyPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">SwiftRescue</h1>
      <NationalLineCard />
      {/* The ambulance and the fire photo, together, directly below the 112 card (owner, 2026-11-03): lazy, a fixed box, no data. */}
      <EmergencyBanner />
      <EmergencyContent />
    </section>
  );
}
