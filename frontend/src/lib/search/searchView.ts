/** The view of the results page (list or map) in the page address. Requirements: FR-07, NFR-07. UI spec 2.3, "Map view".
 *
 * `view=map` shows the map. Anything else, or nothing, shows the list: the list is the default. The view is not a filter, so
 * it is kept apart from lib/search/searchQuery.ts. The address never holds the visitor's position, nor the centre or the
 * zoom of the map: this file writes nothing but `view`.
 */
export type ResultsView = "list" | "map";

/** The view of a query string (with or without "?"). Only the exact text `map` gives the map. */
export function readView(query: string | URLSearchParams): ResultsView {
  const parameters = typeof query === "string" ? new URLSearchParams(query) : query;
  return parameters.get("view") === "map" ? "map" : "list";
}

/** The same query with the view set: `view=map` added at the end, or `view` removed for the list. No leading "?". */
export function withView(query: string, view: ResultsView): string {
  const parameters = new URLSearchParams(query);
  parameters.delete("view");
  if (view === "map") parameters.set("view", "map");
  return parameters.toString();
}
