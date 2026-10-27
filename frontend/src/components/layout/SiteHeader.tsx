/** Header on every page. Requirements: FR-02, NFR-01, NFR-10, US-13. UI spec, "Layout" (redesigned on 2026-10-11; logo and no
 * Find care on the home page since 2026-10-12; transparent on the home page since the fourth revision, R18; a server component
 * since the eighth, R44).
 * The logo and wordmark (to the home page), then Find care, the red SwiftRescue button and For facilities (HeaderNavigation).
 * On a phone only the logo, SwiftRescue and the Menu button show (the menu holds Find care and For facilities), so the red
 * button is always visible. It carries `on-dark`: the focus ring inside it is the light one (globals.css).
 * It is a server component: the layout of the route group says whether this is the home page, so nothing is read in the browser and
 * no JavaScript is sent for it (only the Menu button is client code):
 * - on the home page it is transparent and sits on top of the hero (absolute, above the photo with z-20), with white text; the
 *   hero's photo has a dark veil behind it so the white links stay readable;
 * - on every other page it is the `forest` bar with the 4 px `accent` line, in the normal flow, with `paper` text.
 * It is `relative` or `absolute`, so the phone menu panel can sit right under the bar either way.
 */
import Link from "next/link";

import { HeaderNavigation } from "@/components/layout/HeaderNavigation";
import { Logo } from "@/components/layout/Logo";

const HOME_HEADER = "on-dark absolute inset-x-0 top-0 z-20 text-white";
const BAR_HEADER = "on-dark relative border-b-4 border-accent bg-pine text-paper";

type SiteHeaderProps = { isHomePage: boolean };

export function SiteHeader({ isHomePage }: SiteHeaderProps) {
  return (
    <header className={isHomePage ? HOME_HEADER : BAR_HEADER}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        {/* The header is always dark (the forest bar, or the dark hero), so the logo is in its dark tone: a sky pin would vanish.
            No prefetch on the home page: it must not download other pages' code before it is asked for (R43). */}
        <Link href="/" prefetch={isHomePage ? false : undefined} className="inline-flex min-h-12 items-center">
          <Logo tone="dark" />
        </Link>
        <HeaderNavigation isHomePage={isHomePage} />
      </div>
    </header>
  );
}
