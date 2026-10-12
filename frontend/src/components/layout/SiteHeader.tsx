import Link from "next/link";

import { HeaderNavigation } from "@/components/layout/HeaderNavigation";
import { Logo } from "@/components/layout/Logo";

/** Header on every page. Requirements: FR-02, NFR-10, US-13. UI spec, "Layout" (redesigned on 2026-10-11; logo and no
 * Find care on the home page since 2026-10-12).
 * The logo and wordmark (to the home page), then Find care, the red SwiftRescue button and For facilities (HeaderNavigation).
 * On a phone only the wordmark, SwiftRescue and a Menu button show (the menu holds Find care and For facilities), so the red
 * button is always visible. It has a forest background, so it carries `on-dark`: the focus ring inside it is the light one
 * (globals.css). It is `relative`, so the phone menu panel can sit right under the bar.
 */
export function SiteHeader() {
  return (
    <header className="on-dark relative border-b-4 border-accent bg-forest text-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="inline-flex min-h-12 items-center text-lg font-semibold">
          <Logo />
        </Link>
        <HeaderNavigation />
      </div>
    </header>
  );
}
