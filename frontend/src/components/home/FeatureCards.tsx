/** The row of three feature cards right under the hero: Find care, SwiftRescue and Find blood. Requirements: US-13, US-04, NFR-10.
 * Spec: specs/2026-10-22-home-photos/requirements.md part 3; ui-spec 2.1 (revision of 2026-10-22). Only real pages, only real features.
 * Each card is one link with an icon, no photo and no red (red is for SwiftRescue's own button in the header). The card has no heading of its
 * own, so the page keeps its outline (one h1, an h2 for each part); the link is named by the card title and described by its line.
 * prefetch={false}: the home page does not download another page's code before it is asked for (R43).
 */
import { Droplet, Search, Siren, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_WORDS } from "@/config/home";

const CARD_ICONS: LucideIcon[] = [Search, Siren, Droplet];

export function FeatureCards() {
  return (
    <section aria-label="Ways to use the site" className="reveal bg-pine-50">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <ul className="grid gap-4 md:grid-cols-3">
          {HOME_WORDS.cards.map((card, index) => (
            <li key={card.href}>
              <Link
                href={card.href}
                prefetch={false}
                aria-labelledby={`card-title-${index}`}
                aria-describedby={`card-text-${index}`}
                className="flex h-full min-h-24 items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card hover:border-pine-dark"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine-100 text-forest">
                  <DecorativeIcon icon={CARD_ICONS[index]} className="h-6 w-6" />
                </span>
                <span>
                  <span id={`card-title-${index}`} className="block text-lg font-bold text-forest">
                    {card.title}
                  </span>
                  <span id={`card-text-${index}`} className="mt-1 block text-base text-ink-soft">
                    {card.text}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
