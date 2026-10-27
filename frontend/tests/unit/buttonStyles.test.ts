/** Tests for the button classes. Requirements: NFR-10, US-13. UI spec, "Buttons and text" (the on-dark variant, 2026-10-12, R20).
 */
import { describe, expect, it } from "vitest";

import { buttonClasses } from "@/components/ui/buttonStyles";

import { contrast, tokenColour } from "../helpers/contrast";

describe("buttonClasses", () => {
  it("has an on-dark button: white (snow, which stays white in the dark mode) background, pine-dark text, for the dark hero where the pine button would vanish", () => {
    const classes = buttonClasses("onDark");

    expect(classes).toMatch(/\bbg-snow\b/);
    expect(classes).toMatch(/\btext-pine-dark\b/);
    expect(classes).toMatch(/\bhover:bg-sky-pale\b/); // constant tints, so the hover reads in both modes
    expect(classes).toMatch(/\bactive:bg-sky-pale\b/);
    expect(classes).not.toMatch(/\b(?:hover|active):bg-pine-(?:50|100)\b/); // those two change in the dark mode
    expect(contrast(tokenColour("pine-dark"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("pine-dark"), tokenColour("sky-pale"))).toBeGreaterThanOrEqual(4.5);
  });

  it("has the secondary button: a card surface, forest text, a pine edge that goes light (not dark) on hover in the dark mode", () => {
    const classes = buttonClasses("secondary");

    expect(classes).toMatch(/\bbg-surface\b/);
    expect(classes).toMatch(/\bborder-pine\b/);
    expect(classes).toMatch(/\btext-forest\b/);
    expect(classes).toMatch(/\bhover:border-pine-dark\b/);
    expect(classes).toMatch(/\bdark:hover:border-forest\b/);
    expect(classes).toMatch(/\bdark:active:border-forest\b/);
  });

  it("has the WhatsApp button (owner's Option A): a card surface, a #075E54 border, ink text, the light green hover; never white text on green", () => {
    const classes = buttonClasses("whatsapp");

    expect(classes).toMatch(/\bborder-2\b/);
    expect(classes).toMatch(/\bborder-whatsapp-dark\b/);
    expect(classes).toMatch(/\bbg-surface\b/);
    expect(classes).toMatch(/\btext-ink\b/);
    expect(classes).toMatch(/\bhover:bg-open-bg\b/);
    expect(classes).toMatch(/\bactive:bg-open-bg\b/);
    expect(classes).not.toMatch(/\btext-white\b|\bbg-whatsapp\b|emergency/);
    expect(contrast(tokenColour("ink"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("ink"), tokenColour("open-bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenColour("whatsapp-dark"), "#ffffff")).toBeGreaterThanOrEqual(3);
  });

  it("makes the buttons of the listing page larger on request (Call and WhatsApp): 56 px, not 50 px, and nothing else changes", () => {
    const whatsappLarge = buttonClasses("whatsapp", { large: true });
    expect(whatsappLarge).toMatch(/\bmin-h-14\b/);
    expect(whatsappLarge.replace("min-h-14", "min-h-[50px]")).toBe(buttonClasses("whatsapp"));

    const large = buttonClasses("primary", { large: true });
    const normal = buttonClasses("primary");

    expect(large).toMatch(/\bmin-h-14\b/);
    expect(large).not.toMatch(/min-h-\[50px\]/);
    expect(large.replace("min-h-14", "min-h-[50px]")).toBe(normal);
  });

  it("keeps every variant at 50 px or more, with 16 px text, and only the emergency one is red", () => {
    for (const variant of ["primary", "secondary", "onDark", "whatsapp", "emergency"] as const) {
      expect(buttonClasses(variant), variant).toMatch(/\bmin-h-\[50px\]/);
      expect(buttonClasses(variant), variant).toMatch(/\btext-base\b/);
      expect(/emergency/.test(buttonClasses(variant)), variant).toBe(variant === "emergency");
    }
  });
});
