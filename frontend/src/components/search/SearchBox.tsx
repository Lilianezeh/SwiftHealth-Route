/** The search box: a plain GET form to /search, so it works before any script has loaded. Requirements: FR-01, FR-04, NFR-04.
 * UI spec 2.2, item 3, and 2.3, item 1. The text is sent as `q`; the results page reads it from the address.
 * On the results page, `filters` keeps the other filters of the current search as hidden fields, so searching again for
 * new text does not lose them. The position is never one of them (SearchFilters has no lat or lng).
 */
import { Search } from "lucide-react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { filtersToQuery, type SearchFilters } from "@/lib/search/searchQuery";

type SearchBoxProps = { defaultValue?: string; filters?: SearchFilters };

export function SearchBox({ defaultValue = "", filters = {} }: SearchBoxProps) {
  const otherFilters = [...new URLSearchParams(filtersToQuery({ ...filters, q: undefined }))];

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
      {otherFilters.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={`${buttonClasses("primary")} sm:w-auto`}>
        <DecorativeIcon icon={Search} />
        Search
      </button>
    </form>
  );
}
