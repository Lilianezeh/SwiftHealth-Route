/** The home page: parts 2 to 7 of the eight (the header and the footer come from the root layout).
 * Requirements: US-13, NFR-01, NFR-10, NFR-12. UI spec 2.1; specs/2026-10-11-home-redesign/ (third revision, 2026-10-12).
 * It is a static page: it shows no data from the API and makes no request, so a sleeping API cannot slow it down.
 */
import { BrowseByType } from "@/components/home/BrowseByType";
import { FacilityOwners } from "@/components/home/FacilityOwners";
import { HomeHero } from "@/components/home/HomeHero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Overview } from "@/components/home/Overview";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";

export default function Home() {
  return (
    <>
      <HomeHero />
      <Overview />
      <HowItWorks />
      <BrowseByType />
      <WhySwiftHealth />
      <FacilityOwners />
    </>
  );
}
