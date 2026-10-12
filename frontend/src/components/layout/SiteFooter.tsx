"use client";

/** Footer on every page: information links and the copyright line.
 * Requirements: US-13, NFR-10. UI spec, "Layout"; revision R26 (2026-10-12). The year is a constant of siteConfig. There is no
 * photo credit and no outside link: the Magnific credit was removed on 2026-10-12, when the photos were replaced by two that
 * need none (the owner's statement).
 * The links and the © line are inside the same container as the section headings (max-w-6xl, 16 px at the sides), not at the far
 * left edge. It reads the address (usePathname) only to leave out the gap and the line above it on the home page, where they
 * showed an empty beige band between the last white part and the footer; every other page keeps them.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const isHomePage = usePathname() === "/";

  return (
    <footer className={isHomePage ? "text-base" : "mt-16 border-t border-black/10 text-base"}>
      <div className="mx-auto max-w-6xl px-4 py-8">
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
      </div>
    </footer>
  );
}
