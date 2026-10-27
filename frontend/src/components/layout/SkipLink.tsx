/** "Skip to main content": the first thing a keyboard or a screen reader reaches on every page. Requirements: NFR-10, NFR-04.
 * UI spec 2.10; decision D5 in specs/2026-10-20-info-pages/requirements.md. Hidden until it has focus, then a clear 48 px button at
 * the top left. It goes to `<main id="main">` (PageFrame). A server component: no script.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:inline-flex focus:min-h-12 focus:items-center focus:rounded-xl focus:bg-surface focus:px-4 focus:text-base focus:font-semibold focus:text-forest focus:shadow-card"
    >
      Skip to main content
    </a>
  );
}
