/** About `/about`. Requirements: FR-23, FR-13, FR-26. UI spec 2.10; decision D3 in specs/2026-10-20-info-pages/requirements.md.
 * The words come from the mission page. The first city is read from the settings, never written here. */
import type { Metadata } from "next";

import { InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `What ${brand.name} is: a verified directory of health facilities and emergency contacts, checked by people before it goes live.`,
};

export default function AboutPage() {
  return (
    <InfoPage title="About">
      <InfoSection heading={`What is ${brand.name}?`}>
        <p>
          {brand.name} is a verified directory of health facilities and emergency contacts. You find a facility that is open now, near you, and call it
          or get directions in one tap.
        </p>
        <p>Our team checks every listing before it goes live, and checks it again on a regular cycle, so you can see when it was last verified.</p>
      </InfoSection>
      <InfoSection heading="Where we start">
        <p>
          We start in {siteConfig.launchCity} and are adding more places. The directory is built for all of Nigeria, and other cities can be added
          without changing the name or the way it works.
        </p>
      </InfoSection>
      <InfoSection heading={siteConfig.emergencyName}>
        <p>
          {siteConfig.emergencyName} is the emergency section, with a button on every page. It connects you to emergency contacts. It does not
          dispatch or guarantee an emergency response. In danger, call 112.
        </p>
      </InfoSection>
      <InfoSection heading="What we are not">
        <p>{brand.name} is a directory and does not give medical advice. It does not diagnose, and it does not tell you what treatment to take.</p>
      </InfoSection>
      <InfoSection heading="More">
        <InfoLink href="/how-we-verify">How we verify</InfoLink>
        <InfoLink href="/list-your-facility">List your facility</InfoLink>
        <InfoLink href="/contact">Contact us</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
