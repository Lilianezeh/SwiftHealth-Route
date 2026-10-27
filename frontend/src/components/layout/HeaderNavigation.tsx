/** The links of the header: the bar and the phone menu. Requirements: FR-02, NFR-10, US-13. UI spec, "Layout"; revision R14
 * (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 * On the home page "Find care" is left out, because the hero button does the same; on every other page it is there.
 * SwiftRescue is never left out (FR-02). The header (a server component, like this one) tells it whether this is the home page.
 */
import { Siren } from "lucide-react";
import Link from "next/link";

import { AccountLinks } from "@/components/layout/AccountLinks";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { siteConfig } from "@/config/site";

// px-2 at tablet width, px-3 from desktop: with For facilities and the Theme button the bar is 3 px too wide in 768 px with px-3.
const BAR_LINK =
  "hidden min-h-12 items-center rounded-md px-2 text-base font-semibold hover:underline md:inline-flex lg:px-3";

type HeaderNavigationProps = { isHomePage: boolean };

export function HeaderNavigation({ isHomePage }: HeaderNavigationProps) {
  const menuLinks = siteConfig.menuLinks.filter((link) => !(isHomePage && link.href === siteConfig.findCareLink.href));
  // On the home page no link prefetches the page it points to (R43); on the other pages Next.js's default stays.
  const prefetch = isHomePage ? false : undefined;

  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Main" className="flex items-center gap-2">
        {!isHomePage && (
          <Link href={siteConfig.findCareLink.href} prefetch={prefetch} className={BAR_LINK}>
            {siteConfig.findCareLink.label}
          </Link>
        )}
        <Link
          href={siteConfig.emergencyLink.href}
          prefetch={prefetch}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-md bg-emergency px-2.5 text-base font-semibold text-white sm:px-4"
        >
          {/* A small siren, white like the text (currentColor), hidden from screen readers; never a cross (R36). */}
          <DecorativeIcon icon={Siren} className="h-4 w-4" />
          {siteConfig.emergencyLink.label}
        </Link>
        <Link href={siteConfig.facilitiesLink.href} prefetch={prefetch} className={BAR_LINK}>
          {siteConfig.facilitiesLink.label}
        </Link>
        {/* Log in and Sign up, or My account: the one small client part of the bar (accounts phase 3b, D16). */}
        <AccountLinks prefetch={prefetch} />
        {/* The Theme button, an icon from tablet width (on a phone it is in the Menu): Light, Dark, System. */}
        <ThemeToggle variant="bar" />
      </nav>
      <div className="md:hidden">
        <MobileMenu links={menuLinks} />
      </div>
    </div>
  );
}
