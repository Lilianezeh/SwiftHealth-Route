/** The favicon: the pin of the logo with the heartbeat line, alone. Requirements: US-13, NFR-10. UI spec, "Layout"; revision R38
 * (2026-10-13) in specs/2026-10-11-home-redesign/requirements.md. Next.js serves `src/app/icon.svg` as the tab icon. A favicon
 * cannot read a CSS variable, so its colours are written in the file; the tests check that the blue is the `sky` token (it was the
 * `forest` token before the new logo) and nothing is red.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { tokenColour } from "../helpers/contrast";

const icon = readFileSync(join(process.cwd(), "src", "app", "icon.svg"), "utf8");

describe("the favicon (src/app/icon.svg)", () => {
  it("is an SVG with a viewBox, with the pin and the heartbeat line only", () => {
    expect(icon).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(icon).toMatch(/viewBox="0 0 36 46"/);
    expect(icon.match(/<path /g)).toHaveLength(2);
    expect(icon).toContain('d="M18 45C10 35 2 26 2 17a16 16 0 0 1 32 0c0 9-8 18-16 28z"'); // the shape of the map pins
    expect(icon).toContain('d="M7 18H12.5L15.2 11L19.4 25L22.3 18H29"'); // the heartbeat line
    expect(icon).not.toContain("M16 9h4v6h6v4h-6v6h-4v-6h-6v-4h6z"); // no plus any more
    expect(icon).not.toMatch(/<(image|text|script|circle|rect)\b/);
  });

  it("paints the pin in the sky blue (the sky token) and the line in white, with no other colour", () => {
    const fills = [...icon.matchAll(/fill="(#[0-9a-fA-F]{3,6})"/g)].map((match) => match[1].toLowerCase());
    const strokes = [...icon.matchAll(/stroke="(#[0-9a-fA-F]{3,6}|white)"/g)].map((match) => match[1].toLowerCase());

    expect(fills).toEqual([tokenColour("sky")]); // #1a7cad
    expect(strokes).toEqual(["white"]);
    expect(icon).toMatch(/fill="none"/); // the line is a stroke, not a filled shape
  });

  it("has no red: not the emergency colour, not any red", () => {
    expect(icon.toLowerCase()).not.toContain(tokenColour("emergency"));
    expect(icon.toLowerCase()).not.toMatch(/\bred\b/);
  });

  it("is small: it is loaded on every page", () => {
    expect(icon.length).toBeLessThan(1000);
  });
});
