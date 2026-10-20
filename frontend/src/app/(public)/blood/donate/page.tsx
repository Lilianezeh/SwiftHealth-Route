/** Donate blood: the donor guidance and the donation centres. Requirements: US-16, FR-28, FR-29, FR-19, NFR-01, NFR-10.
 * UI spec 2.7. Feature: specs/2026-10-20-blood/ (decision F3: the guidance text comes from the medical advisor).
 * The page is static; the centres come from the API in the browser (DonateBlood). No sponsored placement here (FR-19).
 */
import type { Metadata } from "next";

import { BloodTabs } from "@/components/blood/BloodTabs";
import { DonateBlood } from "@/components/blood/DonateBlood";
import { DonorGuidance } from "@/components/blood/DonorGuidance";

export const metadata: Metadata = {
  title: "Donate blood",
  description: "Where to donate blood, with the hours of each donation centre.",
};

export default function DonateBloodPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">Donate blood</h1>
      <BloodTabs current="/blood/donate" />
      <DonorGuidance />
      <h2 className="text-xl font-bold text-forest">Donation centres</h2>
      <DonateBlood />
    </section>
  );
}
