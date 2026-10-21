/** The two links at the top of the blood pages: Find blood and Donate blood. Requirements: US-15, US-16, FR-27, FR-28, NFR-10.
 * UI spec 2.6 and 2.7. Plain links (each is its own page), the current one marked with aria-current.
 */
import Link from "next/link";

const TABS = [
  { label: "Find blood", href: "/blood" },
  { label: "Donate blood", href: "/blood/donate" },
] as const;

type BloodTabsProps = { current: (typeof TABS)[number]["href"] };

export function BloodTabs({ current }: BloodTabsProps) {
  return (
    <nav aria-label="Blood">
      <ul className="grid grid-cols-2 gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.href === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-4 text-base font-semibold ${
                  isCurrent ? "border-pine bg-pine text-white" : "border-pine bg-white text-forest"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
