/** The home page: parts 2 to 6 of the seven (the header and the footer come from the root layout).
 * Requirements: US-13, NFR-01, NFR-10, NFR-12. UI spec 2.1; specs/2026-10-11-home-redesign/ (fourth revision, 2026-10-12) and
 * specs/2026-10-15-find-by-type/ (the owner's new words and the page description, D7).
 * It is a static page: it shows no data from the API and makes no request, so a sleeping API cannot slow it down.
 */
import type { Metadata } from "next";

import { FacilityOwners } from "@/components/home/FacilityOwners";
import { FindByType } from "@/components/home/FindByType";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSwiftRescue } from "@/components/home/HomeSwiftRescue";
import { HowWeVerify } from "@/components/home/HowWeVerify";
import { Overview } from "@/components/home/Overview";
import { WhySwiftHealth } from "@/components/home/WhySwiftHealth";
import { HOME_WORDS } from "@/config/home";

// Only the description is the home page's own; the title and the rest come from the root layout. It names no city.
export const metadata: Metadata = { description: HOME_WORDS.description };

export default function Home() {
  return (
    <>
      <HomeHero />
      <Overview />
      <WhySwiftHealth />
      <HowWeVerify />
      <FindByType />
      <HomeSwiftRescue />
      <FacilityOwners />
    </>
  );
}
