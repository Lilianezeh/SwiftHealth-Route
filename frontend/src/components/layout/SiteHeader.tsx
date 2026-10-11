import Link from "next/link";

import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";

const BAR_LINK =
  "hidden min-h-12 items-center rounded-md px-3 text-base font-semibold hover:underline md:inline-flex";

/** Header on every page. Requirements: FR-02, NFR-10, US-13. UI spec, "Layout" (redesigned on 2026-10-11).
 * The wordmark (to the home page), then Find care, the red SwiftRescue button and For facilities. On a phone only the
 * wordmark, SwiftRescue and a Menu button show (the menu holds Find care and For facilities), so the red button is always
 * visible. It has a forest background, so it carries `on-dark`: the focus ring inside it is the light one (globals.css).
 * It is `relative`, so the phone menu panel can sit right under the bar.
 */
export function SiteHeader() {
  return (
    <header className="on-dark relative border-b-4 border-accent bg-forest text-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="inline-flex min-h-12 items-center text-lg font-semibold">
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label="Main" className="flex items-center gap-2">
            <Link href={siteConfig.findCareLink.href} className={BAR_LINK}>
              {siteConfig.findCareLink.label}
            </Link>
            <Link
              href={siteConfig.emergencyLink.href}
              className="inline-flex min-h-12 items-center rounded-md bg-emergency px-4 text-base font-semibold text-white"
            >
              {siteConfig.emergencyLink.label}
            </Link>
            <Link href={siteConfig.facilitiesLink.href} className={BAR_LINK}>
              {siteConfig.facilitiesLink.label}
            </Link>
          </nav>
          <div className="md:hidden">
            <MobileMenu links={siteConfig.menuLinks} />
          </div>
        </div>
      </div>
    </header>
  );
}
