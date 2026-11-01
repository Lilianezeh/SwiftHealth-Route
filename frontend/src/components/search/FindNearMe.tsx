"use client";

/** "Find care near me": choose a type, tap, allow the location, see the nearest places of that type on a map and in a list.
 * Requirements: FR-03, US-01, NFR-07, NFR-10. Spec: specs/2026-11-01-maps-near-me/; UI spec 2.2.
 *
 * The browser asks for the position ONLY after a tap on a type (never when the page opens), and only once per tab: a refusal is
 * remembered and the area list is shown at once. The position is kept in memory (lib/location/locationStore.ts), goes only to the API in
 * the body of a POST, and is in no address, no storage, no log and no tracking. When it is granted the visitor goes to
 * `/search?category=<type>&view=map` (the map with the list under it); when it is refused or cannot be found, they are asked to choose an
 * area and go to the list of that area for the same type.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LocationPrompt } from "@/components/location/LocationPrompt";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { TYPE_CHOICES, type TypeSlug } from "@/config/types";
import { useLocation } from "@/hooks/useLocation";
import { filtersToQuery } from "@/lib/search/searchQuery";
import { withView } from "@/lib/search/searchView";

export function FindNearMe() {
  const router = useRouter();
  const { status, position, area, ask, chooseArea } = useLocation();
  // The type the visitor tapped before there was a position: they go to its results once the browser says yes.
  const [pendingType, setPendingType] = useState<TypeSlug | null>(null);

  useEffect(() => {
    if (pendingType !== null && status === "granted") {
      router.push(`/search?${withView(filtersToQuery({ category: pendingType }), "map")}`);
      setPendingType(null);
    }
  }, [pendingType, status, router]);

  function choose(type: TypeSlug) {
    setPendingType(type);
    if (position) return; // the effect above opens the results at once
    if (status === "idle") ask(); // a refusal is remembered for the tab, so the browser is never asked twice
  }

  function chooseAreaFor(chosen: string) {
    chooseArea(chosen);
    if (pendingType !== null) router.push(`/search?${filtersToQuery({ category: pendingType, area: chosen })}`);
  }

  const refused = status === "denied" || status === "unavailable" || status === "timeout";

  return (
    <section aria-labelledby="near-me-heading" className="flex flex-col gap-3">
      <h2 id="near-me-heading" className="text-xl font-bold text-forest">
        Find care near me
      </h2>
      <p className="text-base text-ink">
        Choose the kind of place. We ask your phone for your location only after you tap. We never keep it.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPE_CHOICES.map((type) => (
          <button
            key={type.slug}
            type="button"
            onClick={() => choose(type.slug)}
            aria-label={`${type.plural} near me`}
            className={buttonClasses("secondary")}
          >
            {type.plural}
          </button>
        ))}
      </div>
      {(refused || status === "asking") && pendingType !== null && (
        <LocationPrompt status={status} area={area} onAsk={() => ask()} onChooseArea={chooseAreaFor} />
      )}
    </section>
  );
}
