/** Part 5 of the home page: why SwiftHealth, four items. Requirements: US-13, NFR-10, NFR-07. UI spec 2.1.
 * The words say only what the product does: no numbers, no quotes. "Your location stays private" is true (NFR-07): the
 * position is kept in the browser tab and sent only to the search.
 */
import { BadgeCheck, Clock, Lock, Signal } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_WORDS } from "@/config/home";

const ITEM_ICONS = [BadgeCheck, Clock, Signal, Lock];

export function WhySwiftHealth() {
  const { heading, items } = HOME_WORDS.why;

  return (
    <section aria-labelledby="why-heading" className="bg-pine-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="why-heading" className="text-2xl font-bold text-forest">
          {heading}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <li key={item.title} className="rounded-2xl border border-line bg-white p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-100 text-forest">
                <DecorativeIcon icon={ITEM_ICONS[index]} className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-lg font-bold text-forest">{item.title}</h3>
              <p className="mt-1 text-base text-ink">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
