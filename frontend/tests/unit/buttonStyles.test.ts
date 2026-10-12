/** Tests for the button classes. Requirements: NFR-10, US-13. UI spec, "Buttons and text" (the on-dark variant, 2026-10-12, R20).
 */
import { describe, expect, it } from "vitest";

import { buttonClasses } from "@/components/ui/buttonStyles";

import { contrast, tokenColour } from "../helpers/contrast";

describe("buttonClasses", () => {
  it("has an on-dark button: white background, pine-dark text, for the dark hero where the pine button would vanish", () => {
    const classes = buttonClasses("onDark");

    expect(classes).toMatch(/\bbg-white\b/);
    expect(classes).toMatch(/\btext-pine-dark\b/);
    expect(classes).toMatch(/\bhover:bg-pine-50\b/);
    expect(classes).toMatch(/\bactive:bg-pine-100\b/);
    expect(contrast(tokenColour("pine-dark"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("pine-dark"), tokenColour("pine-50"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("pine-dark"), tokenColour("pine-100"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every variant at 50 px or more, with 16 px text, and only the emergency one is red", () => {
    for (const variant of ["primary", "secondary", "onDark", "emergency"] as const) {
      expect(buttonClasses(variant), variant).toMatch(/\bmin-h-\[50px\]/);
      expect(buttonClasses(variant), variant).toMatch(/\btext-base\b/);
      expect(/emergency/.test(buttonClasses(variant)), variant).toBe(variant === "emergency");
    }
  });
});
