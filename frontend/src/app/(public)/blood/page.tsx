/** Find blood: verified blood banks and the blood groups they list. Requirements: US-15, FR-27, FR-19, NFR-01, NFR-10.
 * UI spec 2.6. Feature: specs/2026-10-20-blood/. The page is static; the list comes from the API in the browser (BloodFinder).
 * No sponsored placement here (FR-19).
 */
import type { Metadata } from "next";

import { BloodFinder } from "@/components/blood/BloodFinder";
import { BloodTabs } from "@/components/blood/BloodTabs";
import { RegisterServiceWorker } from "@/components/offline/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "Find blood",
  description: "Verified blood banks and the blood groups they list. Call to confirm stock before you go.",
};

export default function BloodPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">Find blood</h1>
      <BloodTabs current="/blood" />
      <p className="text-base text-ink">
        Blood banks we have verified, with the blood groups they list. In an emergency, call 112 first.
      </p>
      <BloodFinder />
      <RegisterServiceWorker pagePath="/blood" />
    </section>
  );
}
