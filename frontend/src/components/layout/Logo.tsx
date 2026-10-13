/** The SwiftHealth Route logo: a map pin with a heartbeat line inside, and the wordmark "SwiftHealth" and "Route".
 * Requirements: US-13, NFR-10. UI spec, "Layout"; revisions R38 to R40 (2026-10-13) in
 * specs/2026-10-11-home-redesign/requirements.md. The owner approved this SVG on 2026-10-13. No red cross, no medical cross.
 *
 * One reusable inline SVG component (no file to load). The pin has the shape of the map pins (src/lib/map/mapIcons.ts); the heartbeat
 * line is inside its round head. Two tones, chosen by the background the logo sits on:
 * - "light": a `sky` pin with a white line; "SwiftHealth" in `pine-dark` (navy) and "Route" in `sky`;
 * - "dark" (the forest bar and the dark hero, so the header always uses it): a white pin with a `sky` line; "SwiftHealth" in white
 *   and "Route" in `sky-pale` (a `sky` pin on the forest bar would be 1.2:1).
 * From 640 px the name is on one line. Below 640 px it is stacked, with "ROUTE" in small (10 px) letter-spaced capitals (the logo
 * counts as an image, so the 16 px text rule does not apply to it). To fit a small phone, "ROUTE" is hidden below 360 px, and
 * below 344 px only the pin is drawn (measured in a real browser: with "ROUTE" hidden "SwiftHealth" still overflowed the screen
 * between 320 and 340 px, and fits from 344 px).
 * Screen readers hear "SwiftHealth Route" once: the whole logo is one image with that label, and the SVG and the words inside it
 * are hidden. The words come from config/brand.ts. The favicon (src/app/icon.svg) is the pin alone, in the light tone.
 */
import { brand } from "@/config/brand";

type LogoTone = "light" | "dark";

const TONES: Record<LogoTone, { pin: string; pulse: string; main: string; accent: string }> = {
  light: { pin: "fill-sky", pulse: "stroke-white", main: "text-pine-dark", accent: "text-sky" },
  dark: { pin: "fill-white", pulse: "stroke-sky", main: "text-white", accent: "text-sky-pale" },
};

type LogoProps = { tone: LogoTone };

/** The pin with the heartbeat line, alone. Decoration: hidden from screen readers. */
export function LogoPin({ tone }: LogoProps) {
  const colours = TONES[tone];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 46"
      width="24"
      height="31"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path className={`logo-pin__body ${colours.pin}`} d="M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z" />
      <path
        className={`logo-pin__pulse ${colours.pulse}`}
        d="M7 18H12.5L15.2 11L19.4 25L22.3 18H29"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ tone }: LogoProps) {
  const colours = TONES[tone];

  return (
    <span role="img" aria-label={brand.name} className="inline-flex items-center gap-2">
      <LogoPin tone={tone} />
      <span
        aria-hidden="true"
        className="flex flex-col gap-0.5 leading-none max-[344px]:hidden sm:flex-row sm:items-baseline sm:gap-1.5"
      >
        <span className={`${colours.main} text-base font-bold sm:text-lg`}>{brand.main}</span>
        <span
          className={`${colours.accent} text-[0.625rem] font-semibold uppercase tracking-[0.22em] max-[359px]:hidden sm:text-lg sm:font-bold sm:normal-case sm:tracking-normal`}
        >
          {brand.accent}
        </span>
      </span>
    </span>
  );
}
