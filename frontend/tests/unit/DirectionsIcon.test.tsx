// @vitest-environment jsdom
/** The Directions icon: a diamond road sign with a right-turn arrow, drawn in code. Requirements: US-03, FR-10, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D5 (owner, 2026-10-11, approved on 2026-10-13 after seeing the preview image, at 24 px).
 * It replaces the lucide `Route` icon in the one shared DirectionsButton, so the cards, the map popups and the listing page all change at once.
 */
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DirectionsButton } from "@/components/listings/DirectionsButton";
import { DirectionsIcon } from "@/components/listings/DirectionsIcon";

const DIAMOND =
  "M13.4 2.3 21.7 10.6a1.9 1.9 0 0 1 0 2.8L13.4 21.7a1.9 1.9 0 0 1-2.8 0L2.3 13.4a1.9 1.9 0 0 1 0-2.8L10.6 2.3a1.9 1.9 0 0 1 2.8 0Z";
const ARROW_STEM = "M9.5 16.5v-4a2.5 2.5 0 0 1 2.5-2.5h3.5";
const ARROW_HEAD = "m13.75 8 2 2-2 2";

/** Every .tsx file under src/, with its path, for the "no other Directions icon" check. */
function sourceFiles(folder = join(process.cwd(), "src")): { path: string; text: string }[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [{ path, text: readFileSync(path, "utf8") }] : [];
  });
}

describe("DirectionsIcon", () => {
  it("is a 24 x 24 drawing made of a diamond, the stem of a right-turn arrow and its head, and nothing else", () => {
    const { container } = render(<DirectionsIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    const paths = [...container.querySelectorAll("path")].map((path) => path.getAttribute("d"));
    expect(paths).toEqual([DIAMOND, ARROW_STEM, ARROW_HEAD]);
    expect(container.querySelector("title, text, image, circle, rect")).toBeNull();
  });

  it("is drawn with the current text colour: no fill, a 2 px round line, so it follows the button's colour", () => {
    const { container } = render(<DirectionsIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}|rgb/); // no colour of its own
  });

  it("is shown at 24 px on the buttons (the owner's choice) and hidden from screen readers like the other icons", () => {
    const { container } = render(<DirectionsIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg?.getAttribute("class")).toMatch(/\bh-6\b/);
    expect(svg?.getAttribute("class")).toMatch(/\bw-6\b/);
    expect(svg?.getAttribute("class")).toMatch(/\bshrink-0\b/);
  });
});

describe("the one Directions button, in every place", () => {
  it("shows the new icon next to the word Directions, and keeps its name and its link", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);

    const link = screen.getByRole("link");
    expect(link.querySelector("svg path")?.getAttribute("d")).toBe(DIAMOND);
    expect(link).toHaveTextContent("Directions");
    expect(link).toHaveAccessibleName("Directions to Night Pharmacy A (opens in a new tab)");
  });

  it("is the only Directions button: the cards and the map popups use it, and no file still draws the old lucide Route icon", () => {
    const files = sourceFiles();
    const users = files.filter((file) => file.text.includes("<DirectionsButton")).map((file) => file.path.replace(process.cwd(), ""));
    expect(users.sort()).toEqual(
      ["/src/components/listings/ListingCard.tsx", "/src/components/search/MapPopup.tsx"].sort(),
    );
    for (const file of files) {
      expect(file.text, file.path).not.toMatch(/import \{[^}]*\bRoute\b[^}]*\} from "lucide-react"/s);
    }
  });
});
