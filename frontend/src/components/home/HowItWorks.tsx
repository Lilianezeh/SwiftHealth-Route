/** Part 3 of the home page: how it works, three steps. Requirements: US-13, NFR-10. UI spec 2.1.
 * Each step has its number (hidden from screen readers: the list already numbers them), a decorative icon and a line.
 */
import { Clock, Phone, Search } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { HOME_WORDS } from "@/config/home";

const STEP_ICONS = [Search, Clock, Phone];

export function HowItWorks() {
  const { heading, steps } = HOME_WORDS.howItWorks;

  return (
    <section aria-labelledby="how-it-works-heading" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="how-it-works-heading" className="text-2xl font-bold text-forest">
          {heading}
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4">
              <span aria-hidden="true" className="text-2xl font-bold text-forest">
                {index + 1}
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pine-100 text-forest">
                <DecorativeIcon icon={STEP_ICONS[index]} className="h-6 w-6" />
              </span>
              <p className="text-lg font-semibold text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
