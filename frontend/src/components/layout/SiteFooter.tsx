import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Footer on every page: information links. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 px-4 py-8 text-sm">
      <nav className="flex flex-wrap gap-x-6 gap-y-3">
        {siteConfig.footerLinks.map((link) => (
          <Link key={link.href} href={link.href} className="underline-offset-4 hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
