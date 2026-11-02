/** Remembers that the visitor chose "Not now" on the home page's install card. Requirements: NFR-03, NFR-04. Spec: specs/2026-11-02-installable-pwa/.
 * One word in localStorage, in this browser only, so the card is not shown again. Every read and write is in a try/catch: in a private
 * window, with blocked site data, or in a preview, the browser can refuse. Then the card is simply not remembered (it hides for this visit
 * and may come back at the next one), and nothing fails. It is only the card on the home page: the Menu always offers the button.
 */
export const BANNER_DISMISSED_KEY = "swifthealth.install-banner-dismissed";

export function readBannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveBannerDismissed(): void {
  try {
    window.localStorage.setItem(BANNER_DISMISSED_KEY, "1");
  } catch {
    // not remembered: the card hides for this visit only
  }
}
