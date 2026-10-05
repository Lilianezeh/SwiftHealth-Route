import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Header on every page: app name on the left, SwiftRescue button on the right. */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between bg-forest px-4 py-3 text-paper">
      <Link href="/find" className="text-lg font-semibold">
        {siteConfig.name}
      </Link>
      <Link
        href="/emergency"
        className="rounded-md bg-emergency px-4 py-2 text-base font-semibold text-white"
      >
        {siteConfig.emergencyName}
      </Link>
    </header>
  );
}
