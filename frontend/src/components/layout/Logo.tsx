/** The SwiftHealth logo: a map pin with a white plus inside, next to the word SwiftHealth. Requirements: US-13, NFR-10.
 * UI spec, "Layout"; revision R16 (2026-10-12) in specs/2026-10-11-home-redesign/requirements.md.
 * An inline SVG (no file to load). The pin has the same shape as the map pins (src/lib/map/mapIcons.ts). It is the bright blue
 * accent with a thin white edge, because the header is forest blue and a forest pin would vanish on it. It is decoration: the word
 * next to it names the link, so screen readers skip the SVG. The favicon (src/app/icon.svg) is this pin alone, in forest blue.
 */
import { siteConfig } from "@/config/site";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 36 46"
        width="24"
        height="31"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="logo-pin__body fill-accent stroke-white"
          strokeWidth="1.5"
          d="M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z"
        />
        <path className="logo-pin__plus fill-white" d="M16 9h4v6h6v4h-6v6h-4v-6h-6v-4h6z" />
      </svg>
      {/* Below 400 px only the pin is drawn, so the header fits 320 px; sr-only keeps the word for screen readers. */}
      <span className="max-[399px]:sr-only">{siteConfig.name}</span>
    </span>
  );
}
