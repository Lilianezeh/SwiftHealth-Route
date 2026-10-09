/** The search box: a plain GET form to /search, so it works before any script has loaded. Requirements: FR-01, FR-04, NFR-04.
 * UI spec 2.2, item 3. The text is sent as `q`; the results page reads it from the address.
 */
import { Search } from "lucide-react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

type SearchBoxProps = { defaultValue?: string };

export function SearchBox({ defaultValue = "" }: SearchBoxProps) {
  return (
    <form role="search" action="/search" method="get" className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="search-box" className="sr-only">
        Search by name, area or service
      </label>
      <input
        id="search-box"
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder="Search hospitals, pharmacies, labs…"
        className="min-h-14 w-full rounded-xl border border-line bg-white px-4 text-base text-ink"
      />
      <button type="submit" className={`${buttonClasses("primary")} sm:w-auto`}>
        <DecorativeIcon icon={Search} />
        Search
      </button>
    </form>
  );
}
