/** The Staff portal `/staff-portal`. Requirements: FR-48, FR-49, NFR-01, NFR-10. UI spec 2.9c. The owner's request of 2026-11-02: Log in
 * and Sign up are not in the header, so visitors do not think they need an account. Staff (the people who check and edit listings) reach
 * them from a small link at the end of the footer. A server page; only the buttons are a client part (they ask whether sign-up is open).
 * It is for staff, so it is not for search engines, and it is not in the header, the Menu or the sitemap.
 */
import type { Metadata } from "next";

import { StaffPortalButtons } from "@/components/account/StaffPortalButtons";
import { InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";

export const metadata: Metadata = {
  title: "Staff portal",
  description: "Log in or sign up as staff.",
  robots: { index: false, follow: false },
};

export default function StaffPortalPage() {
  return (
    <InfoPage title="Staff portal">
      <InfoSection heading="For the team">
        <p>This page is for the people who check and edit listings. Log in if you have an account.</p>
        <p>Facility owners do not need this page. They sign up from For facilities.</p>
        <InfoLink href="/for-facilities">For facilities</InfoLink>
      </InfoSection>
      <StaffPortalButtons />
    </InfoPage>
  );
}
