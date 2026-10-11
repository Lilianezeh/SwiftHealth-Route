import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Footer on every page: information links, the photo credit and the copyright line.
 * Requirements: US-13, NFR-10. UI spec, "Layout" (redesigned on 2026-10-11). The year is a constant of siteConfig.
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
      <p className="mt-4">
        <a
          href={siteConfig.photoCredit.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center underline underline-offset-4"
        >
          {siteConfig.photoCredit.text}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      <p className="mt-2 text-ink-soft">
        © {siteConfig.copyrightYear} {siteConfig.name}
      </p>
    </footer>
  );
}
