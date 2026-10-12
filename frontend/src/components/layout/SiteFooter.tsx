import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Footer on every page: information links and the copyright line.
 * Requirements: US-13, NFR-10. UI spec, "Layout". The year is a constant of siteConfig. There is no photo credit and no outside
 * link: the Magnific credit was removed on 2026-10-12, when the photos were replaced by two that need none (the owner's statement).
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 px-4 py-8 text-base">
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
        {siteConfig.footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-12 items-center underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-ink-soft">
        © {siteConfig.copyrightYear} {siteConfig.name}
      </p>
    </footer>
  );
}
