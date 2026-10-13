import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";

/** The layout of the home page (`/`): the transparent header on top of the hero, and the footer straight after the last part.
 * A route group is not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <PageFrame isHomePage>{children}</PageFrame>;
}
