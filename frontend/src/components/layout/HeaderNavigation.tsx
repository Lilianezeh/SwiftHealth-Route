/** The links of the header: the bar and the phone menu. Requirements: FR-02, NFR-10, US-13. UI spec, "Layout"; revision R14
 * (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 * On the home page "Find care" is left out, because the hero button does the same; on every other page it is there.
 * SwiftRescue is never left out (FR-02). The header (a client component) tells it which page this is.
 */
import Link from "next/link";

import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";

const BAR_LINK =
  "hidden min-h-12 items-center rounded-md px-3 text-base font-semibold hover:underline md:inline-flex";

type HeaderNavigationProps = { isHomePage: boolean };

export function HeaderNavigation({ isHomePage }: HeaderNavigationProps) {
  const menuLinks = siteConfig.menuLinks.filter((link) => !(isHomePage && link.href === siteConfig.findCareLink.href));

  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Main" className="flex items-center gap-2">
        {!isHomePage && (
          <Link href={siteConfig.findCareLink.href} className={BAR_LINK}>
            {siteConfig.findCareLink.label}
          </Link>
        )}
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
        <MobileMenu links={menuLinks} />
      </div>
    </div>
  );
}
