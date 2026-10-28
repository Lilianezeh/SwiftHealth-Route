/** Footer on every page: information links and the copyright line.
 * Requirements: US-13, NFR-01, NFR-10. UI spec, "Layout"; revisions R26 (2026-10-12) and R44 (2026-10-13). The year is a constant of
 * siteConfig. One outside link, at the bottom right: "Photos: Designed by Magnific" (the credit was removed on 2026-10-12, when the photos were
 * replaced by two that need none, and came back on 2026-10-28 as this one line instead of a credit on each photo; specs/2026-10-28-hero-slideshow/).
 * The links and the © line are inside the same container as the section headings (max-w-6xl, 16 px at the sides), not at the far
 * left edge. It is a server component: the layout of the route group says whether this is the home page, where the gap and the line
 * above it are left out (they showed an empty beige band between the last white part and the footer) and the links do not
 * prefetch their pages (R43); every other page keeps the gap, the line and Next.js's default.
 */
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { MAGNIFIC_CREDIT } from "@/config/sitePhotos";

type SiteFooterProps = { isHomePage: boolean };

export function SiteFooter({ isHomePage }: SiteFooterProps) {
  return (
    <footer className={isHomePage ? "text-base" : "mt-16 border-t border-line text-base"}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          {siteConfig.footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={isHomePage ? false : undefined}
              className="inline-flex min-h-12 items-center underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <p className="text-ink-soft">
            © {siteConfig.copyrightYear} {siteConfig.name}
          </p>
          {/* The one credit for the Magnific photos of the whole site (owner, 2026-10-28), at the bottom right; `ml-auto` keeps it on the right
              when it wraps under the © line on a phone. A link of the page's own link colour, 16 px, with a 48 px tap area. */}
          <a
            href={MAGNIFIC_CREDIT.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4"
          >
            Photos: {MAGNIFIC_CREDIT.text}{" "}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
