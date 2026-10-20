/** Privacy `/privacy`. Requirements: FR-23, NFR-07, NFR-13, FR-24. UI spec 2.10; decision D1 in specs/2026-10-20-info-pages/requirements.md.
 * A plain statement of what the product does with data today, each line from a requirement or the code. It makes no legal claim and
 * has not been reviewed by a lawyer (the notice says so). When a feature changes what is kept, this page changes with it. */
import type { Metadata } from "next";

import { DraftNotice, InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${brand.name} keeps about you: your position is never stored, a report's phone number is optional and deleted, and we do not sell personal data.`,
};

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy policy">
      <DraftNotice />
      <InfoSection heading="Your position">
        <p>
          When you ask for places near you, your position is sent with that search to show the nearest ones. We do not store your position, and it is
          left out of our logs. It is never put in a web address.
        </p>
        <p>
          Your browser keeps your position, rounded to about 100 metres, for as long as the tab is open, so you do not have to allow it again on every
          page. It is gone when you close the tab.
        </p>
        <p>
          When you tap &ldquo;Share my location&rdquo; in {siteConfig.emergencyName}, the exact position is put into a message that you send yourself, by WhatsApp or
          SMS. We never receive it and never store it.
        </p>
      </InfoSection>
      <InfoSection heading="Reports">
        <p>
          When you report a problem with a listing, we keep the reason and the comment you wrote. Your phone number is optional: give it only if you
          want us to follow up. Your phone number is deleted when the report is closed.
        </p>
        <p>
          To count how many different people reported the same listing, we keep a scrambled code made from your phone number, or from your network
          address if you gave no number. The code cannot be turned back into either. It is deleted when the report is closed, too.
        </p>
      </InfoSection>
      <InfoSection heading="Listing a facility">
        <p>
          When you use &ldquo;List your facility&rdquo;, we keep the facility details you give, and your contact name and email. Only staff can see your contact name
          and email. They are never shown to the public.
        </p>
      </InfoSection>
      <InfoSection heading="Staff and providers">
        <p>
          Staff and facility owners who have an account have a name, an email address and a phone number on record. A password is stored only as a
          scrambled code, never as the password. A one-time code is sent by SMS at each login. Every change to a listing is recorded with who made it and when.
        </p>
      </InfoSection>
      <InfoSection heading="What your browser keeps">
        <p>
          {siteConfig.emergencyName} keeps a copy of the emergency contacts in your browser, so the page also opens with no network. The copy holds the
          names and numbers of facilities, and no position.
        </p>
      </InfoSection>
      <InfoSection heading="What we do not do">
        <p>We do not sell personal data. Visitors do not need an account, and we do not ask for one.</p>
      </InfoSection>
      <InfoSection heading="Questions">
        <InfoLink href="/contact">Contact us</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
