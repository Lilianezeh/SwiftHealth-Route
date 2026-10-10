import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Header on every page: app name on the left, SwiftRescue button on the right.
 * It has a forest background, so it carries `on-dark`: the focus ring inside it is the light one (globals.css).
 */
export function SiteHeader() {
  return (
    <header className="on-dark flex items-center justify-between border-b-4 border-accent bg-forest px-4 py-2 text-paper">
      <Link href="/find" className="inline-flex min-h-12 items-center text-lg font-semibold">
        {siteConfig.name}
      </Link>
      <Link
        href="/emergency"
        className="inline-flex min-h-12 items-center rounded-md bg-emergency px-4 text-base font-semibold text-white"
      >
        {siteConfig.emergencyName}
      </Link>
    </header>
  );
}
