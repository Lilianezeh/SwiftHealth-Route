/** The frame of a page: the header, the main part and the footer. Requirements: FR-02, NFR-01, NFR-10, US-13. UI spec, "Layout";
 * revision R44 (2026-10-13) in specs/2026-10-11-home-redesign/requirements.md.
 * Each route group has its own layout that draws this frame (`app/(home)/`, `app/(public)/`, `app/(dashboards)/`, and the
 * not-found page), so the layout chooses the transparent home header or the blue bar. The header and the footer are server
 * components: they no longer read the address in the browser, so they send no JavaScript (only the Menu button does).
 */
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";

type PageFrameProps = { isHomePage?: boolean; children: ReactNode };

export function PageFrame({ isHomePage = false, children }: PageFrameProps) {
  return (
    <>
      <SkipLink />
      <SiteHeader isHomePage={isHomePage} />
      {/* tabIndex -1: the skip link moves focus here, so the next Tab starts inside the page (NFR-10). */}
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter isHomePage={isHomePage} />
    </>
  );
}
