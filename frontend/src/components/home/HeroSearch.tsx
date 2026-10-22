/** The search box of the home hero. Requirements: US-01, US-13, NFR-10. Spec: specs/2026-10-22-home-photos/requirements.md part 2 (owner's answer 1).
 * A plain GET form to /search with one field, `q` (the search page's own address word; it is read there as the search text): it works
 * before any script has loaded, and it is a server component. The label is visible, the field and the button are at least 48 px high with
 * 16 px text (so a phone does not zoom in). The button is the white on-dark one of the hero.
 */
import { buttonClasses } from "@/components/ui/buttonStyles";
import { HOME_WORDS } from "@/config/home";

export function HeroSearch() {
  const words = HOME_WORDS.hero;
  return (
    <form action="/search" method="get" role="search" className="mt-6">
      <label htmlFor="hero-search" className="block text-base font-semibold text-white">
        {words.searchLabel}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="hero-search"
          type="search"
          name="q"
          placeholder={words.searchPlaceholder}
          autoComplete="off"
          className="min-h-12 w-full min-w-0 rounded-xl border border-white bg-white px-4 text-base text-ink placeholder:text-ink-soft"
        />
        <button type="submit" className={`${buttonClasses("onDark")} sm:w-auto sm:px-8`}>
          {words.searchButton}
        </button>
      </div>
    </form>
  );
}
