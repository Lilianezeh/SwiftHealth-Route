/** Terms of use `/terms`. Requirements: FR-23, FR-13, FR-26, FR-11, NFR-13. UI spec 2.10; decision D1 in
 * specs/2026-10-20-info-pages/requirements.md; accounts phase 9 adds the rules for accounts, moves and closures (section 6 of
 * specs/2026-10-23-accounts-and-facility-ownership/requirements.md). A plain statement of what the site is and is not, with the
 * sentences of the requirements. It has no legal clause and has not been reviewed by a lawyer (the notice says so). */
import type { Metadata } from "next";

import { DraftNotice, InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `How to use ${brand.name}: a directory, not medical advice; ${siteConfig.emergencyName} does not dispatch help; fees are estimates.`,
};

export default function TermsPage() {
  return (
    <InfoPage title="Terms of use">
      <DraftNotice />
      <InfoSection heading={`How to use ${brand.name}`}>
        <p>{brand.name} is a directory and does not give medical advice. Fees are estimates; confirm with the facility.</p>
      </InfoSection>
      <InfoSection heading="In an emergency">
        <p>
          {siteConfig.emergencyName} connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112.
        </p>
      </InfoSection>
      <InfoSection heading="About what you read here">
        <p>
          Listings are checked by our team and checked again on a cycle, and each one shows when it was last verified. Opening hours, numbers and
          fees can still change between checks. Call before you go, and tell us when something is wrong with &ldquo;Report a problem&rdquo;.
        </p>
        <p>A listing marked &ldquo;Sponsored&rdquo; is paid for by the facility. It is labelled, and it is never in {siteConfig.emergencyName}.</p>
      </InfoSection>
      <InfoSection heading="Accounts">
        <p>
          Anyone can sign up for an account to list or manage a facility. It is one person, one account: do not share it. Keep your password and your
          codes private. Give true details. Do not ask to manage a facility that is not yours.
        </p>
        <p>
          Our team phones the facility to check a claim, and may refuse a request or remove access. An account that is used wrongly may be suspended or
          closed.
        </p>
      </InfoSection>
      <InfoSection heading="Moves and closures">
        <p>
          Tell us when a facility moves or closes. A moved facility is hidden until our team checks the new address; a closed facility is hidden, and
          nothing is deleted.
        </p>
      </InfoSection>
      <InfoSection heading="Fair use">
        <p>
          The staff area is for our team and for facility owners with an account. The report and listing forms are limited in how many times one
          person can send them, to keep the directory accurate.
        </p>
      </InfoSection>
      <InfoSection heading="More">
        <InfoLink href="/privacy">Privacy</InfoLink>
        <InfoLink href="/how-we-verify">How we verify</InfoLink>
        <InfoLink href="/contact">Contact us</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
