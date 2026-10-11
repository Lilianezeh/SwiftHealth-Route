// @vitest-environment jsdom
/** Tests for the pin and the position dot (lib/map/mapIcons.ts). Requirements: FR-07, NFR-10.
 * Decisions 2 and 3 in specs/2026-10-11-map-view/requirements.md: the pin is drawn in code (no image file), blue, never red;
 * the visitor's position is a dark dot, a different shape and colour.
 */
import { describe, expect, it } from "vitest";

import { createPinIcon, createPositionIcon } from "@/lib/map/mapIcons";

import { readSource } from "../helpers/source";

describe("the pin", () => {
  const pin = createPinIcon();
  const html = String(pin.options.html);

  it("is an inline SVG with no image file", () => {
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/<img|url\(|\.png|\.svg|\.jpg|href=/i);
  });

  it("is hidden from screen readers (the marker around it has the accessible name)", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
  });

  it("is at least 48 px wide and high, with its tip on the place", () => {
    expect(pin.options.iconSize).toEqual([48, 48]);
    expect(pin.options.iconAnchor).toEqual([24, 48]);
  });

  it("takes its colours from classes, so the stylesheet decides them (tokens only)", () => {
    expect(html).toContain("map-pin");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb|hsl|fill=|stroke=|style=/i);
  });
});

describe("the position dot", () => {
  const dot = createPositionIcon();
  const html = String(dot.options.html);

  it("is a different shape from the pin: no SVG, a plain round element", () => {
    expect(html).not.toContain("<svg");
    expect(html).toContain("map-position-dot");
    expect(html).not.toContain("map-pin");
  });

  it("is hidden from screen readers; the line under the map says what it is", () => {
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("the map styles (src/styles/map.css)", () => {
  const css = readSource("styles/map.css");

  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  it("paints the pin forest blue with a white plus, and the dot ink with a white ring", () => {
    expect(rule(".map-pin__body")).toMatch(/fill:\s*var\(--color-forest\)/);
    expect(rule(".map-pin__plus")).toMatch(/fill:\s*var\(--color-white\)/);
    expect(rule(".map-position-dot")).toMatch(/background:\s*var\(--color-ink\)/);
    expect(rule(".map-position-dot")).toMatch(/border:[^;]*var\(--color-white\)/);
    expect(rule(".map-position-dot")).toMatch(/border-radius:\s*50%/);
  });

  it("never uses red, the emergency colour, or a hand-written hex, rgb or hsl colour", () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, ""); // the comments may say "never red"
    expect(rules).not.toMatch(/emergency|\bred\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/i);
  });

  it("makes the popup close button and the zoom buttons 48 px wide and high (NFR-10)", () => {
    for (const selector of [".leaflet-container a.leaflet-popup-close-button", ".leaflet-container .leaflet-bar a"]) {
      expect(rule(selector), selector).toMatch(/width:\s*48px/);
      expect(rule(selector), selector).toMatch(/height:\s*48px/);
    }
  });

  it("makes the credit and the popup text 16 px, because Leaflet starts at 12 px and 13 px (NFR-10)", () => {
    expect(rule(".leaflet-container")).toMatch(/font-size:\s*1rem/);
    expect(rule(".leaflet-container .leaflet-popup-content")).toMatch(/font-size:\s*1rem/);
  });

  it("lets the buttons in a popup keep their own colours, which Leaflet's link colour would override", () => {
    expect(rule(".leaflet-container .map-popup a")).toMatch(/color:\s*revert-layer/);
  });
});
