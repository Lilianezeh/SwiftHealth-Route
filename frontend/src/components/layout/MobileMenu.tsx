"use client";

/** The Menu button of the header on a phone, and the panel it opens. Requirements: FR-02, NFR-10, NFR-04. UI spec, "Layout".
 * The only client part of the header. The button shows the word "Menu" and an icon, and says whether the panel is open
 * (aria-expanded). Escape and a chosen link close it, and Escape puts the focus back on the button. The red SwiftRescue
 * button is not in the panel: it stays in the bar, so it is always one tap away.
 */
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

type MobileMenuProps = { links: readonly { label: string; href: string }[] };

export function MobileMenu({ links }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-h-12 items-center gap-2 rounded-md border border-paper/60 px-4 text-base font-semibold"
      >
        <DecorativeIcon icon={isOpen ? X : Menu} />
        Menu
      </button>
      {isOpen && (
        // The header is `relative`, so the panel sits right under the bar, across the whole width.
        <nav
          id={panelId}
          aria-label="Menu links"
          className="absolute inset-x-0 top-full z-20 border-b-4 border-accent bg-forest px-4 pb-3"
        >
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex min-h-12 w-full items-center text-base font-semibold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
