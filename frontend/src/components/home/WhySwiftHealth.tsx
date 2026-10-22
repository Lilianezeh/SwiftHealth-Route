/** Part 4 of the home page: "Why <app name>" (it was "Benefits" until 2026-10-15, D7 of specs/2026-10-15-find-by-type/), four items. Requirements: US-13,
 * NFR-10, NFR-07. UI spec 2.1; revision R23 (2026-10-12): a full-width band in the header blue (`forest`) with white text and
 * white icons (white on forest is 5.61:1, on the `pine-dark` circle 8.92:1). It carries `on-dark`: the focus ring inside it is
 * the light one. The words say only what the product does: no numbers, no quotes. "Your location stays private" is true
 * (NFR-07): the position is kept in the browser tab and sent only to the search.
 */
import { BadgeCheck, Clock, Lock, Signal } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_WORDS } from "@/config/home";

const ITEM_ICONS = [BadgeCheck, Clock, Signal, Lock];

export function WhySwiftHealth() {
  const { heading, items } = HOME_WORDS.why;

  return (
    <section aria-labelledby="why-heading" className="on-dark bg-forest text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="why-heading" className="text-2xl font-bold text-white">
          {heading}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <li key={item.title} className="rounded-2xl border border-white/30 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-dark text-white">
                <DecorativeIcon icon={ITEM_ICONS[index]} className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-1 text-base text-white">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
