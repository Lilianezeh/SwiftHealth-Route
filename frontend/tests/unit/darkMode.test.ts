/** Dark mode: the colours. Requirements: NFR-10 (contrast and readable text), FR-06; the owner's request of 2026-10-26.
 * Spec: specs/frontend/ui-spec.md, "Dark mode" (specs/2026-10-27-dark-mode/). The tokens of src/styles/globals.css, in the light `@theme`
 * block and in the two dark blocks (`html[data-theme="dark"]`, and the same under `prefers-color-scheme: dark` for a browser with no script).
 * WCAG AA in both modes: 4.5:1 for text, 3:1 for a button edge, the focus ring and the 112 card's border.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");

function declarations(block: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of block.matchAll(/(--color-[a-z0-9-]+|color-scheme):\s*([^;]+);/g)) values[match[1]] = match[2].trim().toLowerCase();
  return values;
}

const LIGHT = Object.fromEntries(
  Object.entries(declarations(CSS.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "")).map(([name, value]) => [name.replace("--color-", ""), value]),
);
const ATTRIBUTE_BLOCK = CSS.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? "";
const MEDIA_BLOCK = CSS.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}\s*\}/)?.[1] ?? "";
const DARK_RAW = declarations(ATTRIBUTE_BLOCK);
const DARK = { ...LIGHT, ...Object.fromEntries(Object.entries(DARK_RAW).map(([name, value]) => [name.replace("--color-", ""), value])) };

/** The tokens that change in dark mode, and the ones that never do (the blue bars, the hero, the buttons, the logo, the red). */
const ROLE_TOKENS = [
  "page", "surface", "ink", "ink-soft", "line", "forest", "pine-100", "pine-50", "open", "open-bg", "closed", "closed-bg",
  "amber-ink", "amber-wash", "whatsapp-dark", "alert",
];
const CONSTANT_TOKENS = ["pine", "pine-dark", "accent", "amber", "paper", "on-amber", "emergency", "sky", "sky-pale", "snow"];

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const colour = (tokens: Record<string, string>, name: string) => (name === "white" ? "#ffffff" : tokens[name]);

describe("the white that stays white", () => {
  it("is the snow token, the same in both modes, and white is not a theme token", () => {
    expect(LIGHT.snow).toBe("#ffffff");
    expect(DARK.snow).toBe("#ffffff");
  });
});

describe("the dark blocks", () => {
  it("exist twice: under data-theme=dark, and under prefers-color-scheme for a browser with no script", () => {
    expect(ATTRIBUTE_BLOCK).not.toBe("");
    expect(MEDIA_BLOCK).not.toBe("");
  });

  it("hold exactly the same values, so the two ways to get the dark mode cannot differ", () => {
    expect(declarations(MEDIA_BLOCK)).toEqual(declarations(ATTRIBUTE_BLOCK));
  });

  it("change exactly the role tokens, tell the browser it is dark, and touch no constant token", () => {
    const changed = Object.keys(DARK_RAW).filter((name) => name.startsWith("--color-")).map((name) => name.replace("--color-", "")).sort();
    expect(changed).toEqual([...ROLE_TOKENS].sort());
    expect(DARK_RAW["color-scheme"]).toBe("dark");
    for (const name of CONSTANT_TOKENS) expect(DARK[name], name).toBe(LIGHT[name]);
  });

  it("give every role token a different colour in the dark (a role token that did not change would be a mistake)", () => {
    for (const name of ROLE_TOKENS) expect(DARK[name], name).not.toBe(LIGHT[name]);
  });

  it("write every value as a six-digit hex colour", () => {
    for (const [name, value] of Object.entries(DARK_RAW)) if (name.startsWith("--color-")) expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("make the page and the surface dark, and the text light", () => {
    expect(luminance(DARK.page)).toBeLessThan(0.05);
    expect(luminance(DARK.surface)).toBeLessThan(0.05);
    expect(luminance(DARK.ink)).toBeGreaterThan(0.6);
  });
});

describe("the light mode did not change", () => {
  it.each([
    ["page", "#f6f3ec"],
    ["surface", "#ffffff"],
    ["ink", "#1d2421"],
    ["forest", "#1b6f93"],
    ["pine", "#1b6f93"],
    ["alert", "#b3261e"],
    ["on-amber", "#1d2421"],
  ])("%s is %s", (name, value) => {
    expect(LIGHT[name]).toBe(value);
  });
});

describe("every text and background pair is at least 4.5:1 in the dark mode (NFR-10)", () => {
  it.each([
    ["ink", "page", "body text"],
    ["ink", "surface", "body text on a card"],
    ["ink-soft", "page", "secondary text on the page"],
    ["ink-soft", "surface", "secondary text on a card"],
    ["ink", "pine-50", "text on a light panel"],
    ["ink-soft", "pine-50", "secondary text on a light panel"],
    ["ink", "pine-100", "text on the highlighted panel"],
    ["forest", "page", "headings and links on the page"],
    ["forest", "surface", "headings, links and the secondary button text on a card"],
    ["forest", "pine-50", "a heading on a light panel"],
    ["forest", "pine-100", "the Verified label"],
    ["forest", "open-bg", "a heading on the green wash"],
    ["forest", "closed-bg", "a heading on the grey wash"],
    ["open", "open-bg", "Open now"],
    ["closed", "closed-bg", "Closed"],
    ["amber-ink", "amber-wash", "Verification due and the error panels"],
    ["ink", "amber-wash", "text in an error panel"],
    ["ink", "open-bg", "the label of the WhatsApp button on hover"],
    ["ink-soft", "closed-bg", "secondary text on the grey wash"],
    ["alert", "page", "red text on the page"],
    ["alert", "surface", "red text on a card"],
    ["white", "pine", "the primary button"],
    ["white", "pine-dark", "the primary button on hover"],
    ["paper", "pine", "the text of the blue header bar"],
    ["sky-pale", "pine", "Route in the logo on the bar"],
    ["on-amber", "amber", "the Sponsored tag"],
    ["white", "emergency", "SwiftRescue and Call 112"],
    ["pine-dark", "snow", "the white hero button (unchanged)"],
    ["pine-dark", "sky-pale", "the white hero button on hover and press"],
  ])("%s on %s (%s)", (foreground, background) => {
    expect(contrast(colour(DARK, foreground), colour(DARK, background))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("edges and the focus ring are at least 3:1 in the dark mode (WCAG 1.4.11, 2.4.11)", () => {
  it.each(["page", "surface", "pine-50", "pine-100", "open-bg", "closed-bg", "amber-wash"])("the forest ring on %s", (background) => {
    expect(contrast(DARK.forest, DARK[background])).toBeGreaterThanOrEqual(3);
  });

  it("the paper ring on the blue bar and the hero stays at least 3:1 (it never changes)", () => {
    expect(contrast(DARK.paper, DARK.pine)).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK.paper, DARK.sky)).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK.paper, DARK["pine-dark"])).toBeGreaterThanOrEqual(3);
  });

  it("the edge of a secondary button (pine) shows against a card and against the page", () => {
    expect(contrast(DARK.pine, DARK.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK.pine, DARK.page)).toBeGreaterThanOrEqual(3);
  });

  it("the border of the WhatsApp button shows against a card and its hover wash", () => {
    expect(contrast(DARK["whatsapp-dark"], DARK.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK["whatsapp-dark"], DARK["open-bg"])).toBeGreaterThanOrEqual(3);
  });

  it("the 112 card keeps a clearly red border on a dark card, and the Call 112 button stays the same red with white text", () => {
    expect(contrast(DARK.alert, DARK.surface)).toBeGreaterThanOrEqual(3);
    expect(DARK.emergency).toBe("#b3261e");
    const [red, green, blue] = [1, 3, 5].map((start) => parseInt(DARK.alert.slice(start, start + 2), 16));
    expect(red).toBeGreaterThan(green + 60); // still red, not pink or orange
    expect(red).toBeGreaterThan(blue + 60);
    expect(contrast("#ffffff", DARK.emergency)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the Tailwind dark variant and the page", () => {
  it("is declared on the data-theme attribute, so `dark:` classes follow the choice", () => {
    expect(CSS).toMatch(/@custom-variant dark \(&:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)\);/);
  });

  it("paints the body with the page token and the ink token, not with paper", () => {
    const body = CSS.match(/\nbody\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(body).toMatch(/background:\s*var\(--color-page\)/);
    expect(body).toMatch(/color:\s*var\(--color-ink\)/);
  });

  it("tells the browser which schemes it can draw, so its own fields and scrollbars follow", () => {
    expect(CSS).toMatch(/:root\s*\{[^}]*color-scheme:\s*light dark/);
    expect(CSS).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light/);
  });
});
