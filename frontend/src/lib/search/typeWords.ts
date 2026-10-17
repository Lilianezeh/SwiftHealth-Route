/** Turns a typed type word into the type it means. Requirements: FR-04, US-05. Spec: specs/2026-10-15-find-by-type/requirements.md D5.
 * The whole text must be a type word: "pharmacy" is the pharmacy type, "pharmacy ogui" stays a text search. Anything else (a name, an
 * emergency word, a typing mistake) gives nothing, and the text is searched as before.
 */
import { TYPE_WORDS } from "@/config/typeWords";
import type { TypeSlug } from "@/config/types";
import type { SearchFilters } from "@/lib/search/searchQuery";

/** Letters and digits only, in lower case: "Drug-Store", "drug  store" and "DRUGSTORE" are all "drugstore". */
function toKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TYPE_BY_KEY = new Map<string, TypeSlug>(
  (Object.entries(TYPE_WORDS) as [TypeSlug, readonly string[]][]).flatMap(([slug, words]) =>
    words.map((word): [string, TypeSlug] => [toKey(word), slug]),
  ),
);

/** The word itself, then without a final "s" (labs, chemist shops), then "ies" turned into "y" (pharmacies, dispensaries). */
function candidates(key: string): string[] {
  const found = [key];
  if (key.endsWith("s")) found.push(key.slice(0, -1));
  if (key.endsWith("ies")) found.push(`${key.slice(0, -3)}y`);
  return found;
}

export function resolveTypeWord(text: string | undefined): TypeSlug | null {
  const key = toKey(text ?? "");
  if (key === "") return null;
  for (const candidate of candidates(key)) {
    const slug = TYPE_BY_KEY.get(candidate);
    if (slug) return slug;
  }
  return null;
}

/** The filters with a typed type word turned into the type: the text is dropped and `category` is set. A typed type replaces a chosen one
 * (the visitor said it last); the same type again only clears the text. Filters without a type word come back as the same object. */
export function applyTypeWord(filters: SearchFilters): SearchFilters {
  const slug = resolveTypeWord(filters.q);
  if (slug === null) return filters;
  return { ...filters, q: undefined, category: slug };
}
