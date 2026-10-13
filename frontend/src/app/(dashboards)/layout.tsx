import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";

/** The layout of the dashboards (`/admin` and `/provider`): the same blue header bar and footer as the public pages. A route group is
 * not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 */
export default function DashboardsLayout({ children }: { children: ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
