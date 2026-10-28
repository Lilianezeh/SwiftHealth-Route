"use client";

/** The Menu button of the header on a phone, and the panel it opens. Requirements: FR-02, NFR-10, NFR-04. UI spec, "Layout".
 * The only client part of the header. The button is an icon only (a 48 px square named "Menu" by its aria-label, since 2026-10-13,
 * to leave room for the full wordmark on a phone) and says whether the panel is open (aria-expanded). Escape and a chosen link close it, and Escape puts the focus back on the button. The red SwiftRescue
 * button is not in the panel: it stays in the bar, so it is always one tap away.
 */
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { siteConfig } from "@/config/site";
import { useSignupOpen } from "@/hooks/useSignupOpen";
import { useStaffUser } from "@/hooks/useStaffUser";
import { homeAddressFor } from "@/lib/staff/roles";

type MobileMenuProps = { links: readonly { label: string; href: string }[] };

export function MobileMenu({ links }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  // After the page links: Log in and Sign up, or My account when a session exists in the tab (accounts phase 3b, D16).
  // "Sign up" only while sign-up is open (GET /meta, one shared request); "Log in" always.
  const user = useStaffUser();
  const signUpIsOpen = useSignupOpen();
  const allLinks = user
    ? [...links, { label: siteConfig.myAccountLabel, href: homeAddressFor(user.role) }]
    : [...links, siteConfig.logInLink, ...(signUpIsOpen ? [siteConfig.signUpLink] : [])];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Listen for Escape only while the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md border border-paper"
      >
        <DecorativeIcon icon={isOpen ? X : Menu} className="h-6 w-6" />
      </button>
      {isOpen && (
        // The header is `relative`, so the panel sits right under the bar, across the whole width.
        <nav
          id={panelId}
          aria-label="Menu links"
          className="absolute inset-x-0 top-full z-20 border-b-4 border-accent bg-bar px-4 pb-3"
        >
          <ul className="flex flex-col">
            {allLinks.map((link) => (
              <li key={link.href}>
                {/* No prefetch: the panel only exists once the visitor has opened it, and the home page must stay light (R43). */}
                <Link
                  href={link.href}
                  prefetch={false}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex min-h-12 w-full items-center text-base font-semibold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {/* The Theme button (Light, Dark, System) is the last row of the panel; in the bar it is an icon from tablet width. */}
            <li>
              <ThemeToggle variant="menu" />
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}
