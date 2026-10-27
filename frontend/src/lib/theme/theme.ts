/** The colour theme choice: Light, Dark or System. Requirements: NFR-10, NFR-07. Spec: specs/frontend/ui-spec.md, "Dark mode".
 * The choice is the only thing kept, in the browser (`localStorage`, one key); System keeps nothing. The page has a `data-theme`
 * attribute on `<html>` that is `light` or `dark`: the choice, or the system's when the choice is System. A few lines of script in the
 * `<head>` (`themeScript.ts`) set it before the first paint; this file does the same when the person presses the Theme button.
 * Every function copes with a browser whose storage throws (private mode).
 */

export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_KEY = "swifthealth.theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The next choice when the button is pressed. */
export function nextChoice(choice: ThemeChoice): ThemeChoice {
  return THEME_CHOICES[(THEME_CHOICES.indexOf(choice) + 1) % THEME_CHOICES.length];
}

/** What is kept: Light or Dark, else System. */
export function readChoice(): ThemeChoice {
  try {
    const kept = window.localStorage.getItem(THEME_KEY);
    return kept === "light" || kept === "dark" ? kept : "system";
  } catch {
    return "system";
  }
}

/** Keeps Light and Dark; System removes the key, so nothing is kept for a person who never chose. */
export function saveChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // nothing to do: without storage the choice lasts until the page is closed
  }
}

export function resolveTheme(choice: ThemeChoice, systemIsDark: boolean): Theme {
  if (choice === "system") return systemIsDark ? "dark" : "light";
  return choice;
}

function systemIsDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/** Puts the theme of this choice on the page. */
export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(choice, systemIsDark()));
}
