/** For facilities `/for-facilities`. Requirements: FR-23, FR-44, FR-45, FR-50, FR-51, NFR-12. UI spec 2.9b; api-spec section 3
 * (`featured_price_naira` of GET /meta) and section 8 ("Sponsored rules"). A page for owners who have not decided yet: listing is
 * free, how verification works, Featured and its price, how to claim a facility, and the buttons "Sign up as a facility owner" and
 * "Log in" (once, near the top: since 2026-11-03 they are no longer repeated at the end, where "List your facility" is; Log in and
 * Sign up are not in the header since 2026-11-02). A server page; the price and the two buttons are the only client parts. It names no city, and the price is never written here: it comes from the API
 * (the setting FEATURED_PRICE_NAIRA), so the page cannot disagree with what a provider pays.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { ForFacilitiesButtons, FeaturedPrice } from "@/components/facility/ForFacilitiesParts";
import { InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "For facilities",
  description: `List your facility on ${brand.name} for free, see how we verify it, and learn how to claim it and how Featured works.`,
};

export default function ForFacilitiesPage() {
  return (
    <InfoPage title="For facilities">
      <p className="text-base leading-relaxed text-ink">
        {brand.name} helps people find verified healthcare facilities. Here is what listing costs, how we verify, and how to claim yours.
      </p>
      <ForFacilitiesButtons />
      <InfoSection heading="Listing is free">
        <p>Listing is free during our launch. Our team checks every listing before it goes live.</p>
      </InfoSection>
      <InfoSection heading="How verification works">
        <p>
          Before a facility is listed, our team makes a call and a visit. Every listing shows when it was last verified, and our team checks
          again on a cycle. Paying never buys the Verified label.
        </p>
        <InfoLink href="/how-we-verify">How we verify</InfoLink>
      </InfoSection>
      <InfoSection heading="Featured">
        <p>
          A featured listing appears first in matching searches, with a Sponsored label, for 30 days. Only a published, verified listing can be
          featured. It is never in {siteConfig.emergencyName}, and paying does not change verification.
        </p>
        <FeaturedPrice />
      </InfoSection>
      <InfoSection heading="How to claim your facility">
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>Sign up and confirm your email and phone.</li>
          <li>Search for your facility and ask to manage it, or register it if it is not listed.</li>
          <li>Our team phones the facility to check that you may manage it.</li>
          <li>Once approved, you can edit it, move or close it, add branches and, as an owner, get it featured.</li>
        </ol>
      </InfoSection>
      {/* Sign up and Log in are near the top only (owner, 2026-11-03); the end of the page leads to listing a facility. */}
      <Link href="/list-your-facility" prefetch={false} className={buttonClasses("secondary")}>
        List your facility
      </Link>
    </InfoPage>
  );
}
