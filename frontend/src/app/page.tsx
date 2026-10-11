/** The home page: parts 2 to 8 of the nine (the header and the footer come from the root layout).
 * Requirements: US-13, NFR-01, NFR-10, NFR-12. UI spec 2.1; specs/2026-10-11-home-redesign/.
 * It is a static page: it shows no data from the API and makes no request, so a sleeping API cannot slow it down.
 */
import { AboutSwiftHealth } from "@/components/home/AboutSwiftHealth";
import { BrowseByType } from "@/components/home/BrowseByType";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { RescueBand } from "@/components/home/RescueBand";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";

export default function Home() {
  return (
    <>
      <HomeHero />
      <HowItWorks />
      <BrowseByType />
      <WhySwiftHealth />
      <RescueBand />
      <FacilityOwners />
      <AboutSwiftHealth />
    </>
  );
}
