/** The favicon: the pin of the logo alone. Requirements: US-13, NFR-10. UI spec, "Layout"; revision R16 (2026-10-12) in
 * specs/2026-10-11-home-redesign/requirements.md. Next.js serves `src/app/icon.svg` as the tab icon. A favicon cannot read a CSS
 * variable, so its colours are written in the file; the tests check that the blue is the `forest` token and nothing is red.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { tokenColour } from "../helpers/contrast";

const icon = readFileSync(join(process.cwd(), "src", "app", "icon.svg"), "utf8");

describe("the favicon (src/app/icon.svg)", () => {
  it("is an SVG with a viewBox, with the pin and the plus only", () => {
    expect(icon).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(icon).toMatch(/viewBox="[^"]+"/);
    expect(icon.match(/<path /g)).toHaveLength(2);
    expect(icon).not.toMatch(/<(image|text|script|circle|rect)\b/);
  });

  it("paints the pin in the forest blue and the plus in white", () => {
    const colours = [...icon.matchAll(/fill="(#[0-9a-fA-F]{3,6}|white)"/g)].map((match) => match[1].toLowerCase());

    expect(colours).toContain(tokenColour("forest"));
    expect(colours).toContain("white");
    expect(new Set(colours)).toEqual(new Set([tokenColour("forest"), "white"]));
  });

  it("has no red: not the emergency colour, not any red", () => {
    expect(icon.toLowerCase()).not.toContain(tokenColour("emergency"));
    expect(icon.toLowerCase()).not.toMatch(/\bred\b/);
  });

  it("is small: it is loaded on every page", () => {
    expect(icon.length).toBeLessThan(1000);
  });
});
