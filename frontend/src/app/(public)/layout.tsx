import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";
import { PublicPwa } from "@/components/pwa/PublicPwa";

/** The layout of the public pages (find, search, listing, emergency and the rest): the blue header bar, and the footer with its gap
 * and line. A route group is not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 * It also carries the service worker and the install listener on every public page (components/pwa/PublicPwa.tsx;
 * specs/2026-11-02-installable-pwa/), not only on SwiftRescue.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageFrame>{children}</PageFrame>
      <PublicPwa />
    </>
  );
}
