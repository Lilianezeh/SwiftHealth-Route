/** Pins the font of a page in a real-browser check, so the layout results do not depend on which fonts the machine has.
 * Why: the site uses the visitor's own system font (Tailwind's `font-sans`: no web font is downloaded, on purpose, for speed). On a
 * machine with only DejaVu Sans (this laptop, Ubuntu's Chromium) the fallback is a wide font, wider than the Roboto of an Android
 * phone, the San Francisco of an iPhone or the Segoe UI of Windows, so the header came out up to 27 px too wide between 344 and
 * 370 px and the 320 x 568 first screen 21 px too tall (LOG.md, 2026-10-13). The checks now ask for a typical phone-width font
 * first (Roboto, then Ubuntu Sans, which is close to it and is on Ubuntu, then Arial); only if none exists is the machine's own
 * fallback used. This changes nothing in the site: it is injected by the test into the page it measures.
 */
import type { Page } from "@playwright/test";

const PINNED_FONT_CSS = '*, *::before, *::after { font-family: Roboto, "Ubuntu Sans", "Helvetica Neue", Arial, sans-serif !important; }';

/** Call before the first `page.goto`; the style is added to every page the test opens, as soon as its document exists. */
export async function pinFont(page: Page): Promise<void> {
  await page.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    });
  }, PINNED_FONT_CSS);
}
