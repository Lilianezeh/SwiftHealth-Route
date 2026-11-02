import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";
import { PublicPwa } from "@/components/pwa/PublicPwa";

/** The layout of the home page (`/`): the transparent header on top of the hero, and the footer straight after the last part.
 * A route group is not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 * It also carries the service worker and the install listener (components/pwa/PublicPwa.tsx; specs/2026-11-02-installable-pwa/).
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageFrame isHomePage>{children}</PageFrame>
      <PublicPwa />
    </>
  );
}
