/** Contact us `/contact`. Requirements: FR-23, NFR-07. UI spec 2.10; decision D2 in specs/2026-10-20-info-pages/requirements.md.
 * No address and no phone number is written here: none was given. `siteConfig.contactEmail` is empty until the owner sets it; then a
 * mailto link shows. Until then the page points to what works today. */
import type { Metadata } from "next";

import { InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact us",
  description: `How to reach the ${brand.name} team, report a problem with a listing, or list your facility.`,
};

export default function ContactPage() {
  const email = siteConfig.contactEmail;
  return (
    <InfoPage title="Contact us">
      <InfoSection heading="Write to us">
        {email ? (
          <InfoLink href={`mailto:${email}`}>{email}</InfoLink>
        ) : (
          <p>Our contact address is being set up. Until then, use the ways below.</p>
        )}
      </InfoSection>
      <InfoSection heading="Something is wrong with a listing">
        <p>Open the listing and use &ldquo;Report a problem with this listing&rdquo;. You do not need an account, and your phone number is optional.</p>
      </InfoSection>
      <InfoSection heading="You own or manage a facility">
        <InfoLink href="/list-your-facility">List your facility</InfoLink>
      </InfoSection>
      <InfoSection heading="In an emergency">
        <p>Do not wait for a reply. Call 112, or open {siteConfig.emergencyName} for the emergency contacts.</p>
        <InfoLink href="/emergency">{siteConfig.emergencyName}</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
