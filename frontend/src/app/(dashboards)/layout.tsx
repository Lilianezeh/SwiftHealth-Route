import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageFrame } from "@/components/layout/PageFrame";

// The staff and provider pages are not for search engines (decision D7 in specs/2026-10-20-info-pages/requirements.md).
export const metadata: Metadata = { title: "Staff area", robots: { index: false, follow: false } };

/** The layout of the dashboards (`/admin` and `/provider`): the same blue header bar and footer as the public pages. A route group is
 * not part of the address. Requirements: NFR-01, US-13; revision R44 in specs/2026-10-11-home-redesign/.
 */
export default function DashboardsLayout({ children }: { children: ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
