/** The category shortcuts of the Find page, as plain links. Requirements: FR-01, NFR-10. UI spec 2.2, item 4.
 * The row scrolls sideways inside itself, so the page never does.
 */
import Link from "next/link";

import { BLOOD_SHORTCUT, CATEGORY_SHORTCUTS } from "@/config/search";

const SHORTCUT_CLASSES =
  "inline-flex min-h-12 items-center whitespace-nowrap rounded-full border border-line bg-white px-4 text-base font-semibold text-forest";

export function CategoryShortcuts() {
  const shortcuts = [
    ...CATEGORY_SHORTCUTS.map((shortcut) => ({ label: shortcut.label, href: `/search?category=${shortcut.slug}` })),
    { label: BLOOD_SHORTCUT.label, href: BLOOD_SHORTCUT.href },
  ];

  return (
    <nav aria-label="Categories" className="max-w-full">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.href}>
            <Link href={shortcut.href} className={SHORTCUT_CLASSES}>
              {shortcut.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
