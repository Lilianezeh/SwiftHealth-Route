import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";

/** The layout of the public pages (find, search, listing, emergency and the rest): the blue header bar, and the footer with its gap
 * and line. A route group is not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
