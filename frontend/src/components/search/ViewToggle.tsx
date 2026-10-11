/** The List | Map toggle of the results page. Requirements: FR-07, NFR-10. UI spec, the `ViewToggle` row.
 * Two buttons in one group; the current view is marked with aria-pressed (and shown filled), so it is told in words and
 * state, not only in colour. Tapping the view that is already shown does nothing.
 */
import type { ResultsView } from "@/lib/search/searchView";

type ViewToggleProps = { view: ResultsView; onChange: (view: ResultsView) => void };

const CHOICES: { view: ResultsView; label: string }[] = [
  { view: "list", label: "List" },
  { view: "map", label: "Map" },
];

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="Results view" className="flex overflow-hidden rounded-xl border border-pine">
      {CHOICES.map((choice) => {
        const isCurrent = choice.view === view;
        return (
          <button
            key={choice.view}
            type="button"
            aria-pressed={isCurrent}
            onClick={() => {
              if (!isCurrent) onChange(choice.view);
            }}
            className={`min-h-12 flex-1 px-4 text-base font-semibold ${
              isCurrent ? "bg-pine text-white" : "bg-white text-forest hover:bg-pine-50 active:bg-pine-100"
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
