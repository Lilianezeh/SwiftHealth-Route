/** How we verify `/how-we-verify`. Requirements: FR-23, FR-08, FR-22, FR-33, FR-45, US-07, NFR-08. UI spec 2.10; decision D4 in
 * specs/2026-10-20-info-pages/requirements.md. Every sentence states a rule of the product that the requirements or the code set;
 * nothing is said about how many listings are verified. */
import type { Metadata } from "next";

import { InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "How we verify",
  description: `How ${brand.name} checks a listing before it goes live, how often it is checked again, and what happens when something is wrong.`,
};

export default function HowWeVerifyPage() {
  return (
    <InfoPage title="How we verify">
      <InfoSection heading="Before a listing goes live">
        <p>
          Every listing starts as a draft. A member of our team checks it with a call and a visit, and writes down what they found: who they reached,
          what they saw and when. Only when both checks have passed can an editor publish it.
        </p>
        <p>Only published listings are shown to the public.</p>
      </InfoSection>
      <InfoSection heading="The date you see">
        <p>Every listing shows when it was last verified, for example &ldquo;Verified 3 days ago&rdquo;.</p>
      </InfoSection>
      <InfoSection heading="Checked again, on a cycle">
        <p>Emergency contacts are checked again every 14 days. Every other listing is checked again every 45 days.</p>
        <p>
          If a check date has passed and the listing has not been checked again yet, it stays visible with the label &ldquo;Verification due&rdquo; and the
          date it was last verified. A listing that fails a check is hidden until it is put right.
        </p>
      </InfoSection>
      <InfoSection heading="When you tell us something is wrong">
        <p>
          Every listing has a &ldquo;Report a problem&rdquo; link. You do not need an account. If two different people report that a number is not
          working within 7 days, the listing is hidden from the public until our team checks it again.
        </p>
      </InfoSection>
      <InfoSection heading="Payment and verification">
        <p>
          A payment does not buy the verified label. A facility that pays for a featured listing may appear first in matching search results, labelled
          &ldquo;Sponsored&rdquo;. Sponsored listings are never in {siteConfig.emergencyName}.
        </p>
      </InfoSection>
      <InfoSection heading="More">
        <InfoLink href="/list-your-facility">List your facility</InfoLink>
        <InfoLink href="/privacy">Privacy</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
