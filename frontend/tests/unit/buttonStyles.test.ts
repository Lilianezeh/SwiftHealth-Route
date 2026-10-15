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

  it("has the WhatsApp button (owner's Option A): white, a #075E54 border, ink text, the light green hover; never white text on green", () => {
    const classes = buttonClasses("whatsapp");

    expect(classes).toMatch(/\bborder-2\b/);
    expect(classes).toMatch(/\bborder-whatsapp-dark\b/);
    expect(classes).toMatch(/\bbg-white\b/);
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
