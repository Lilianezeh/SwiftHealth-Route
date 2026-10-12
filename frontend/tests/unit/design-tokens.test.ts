/** Tests for the design tokens in src/styles/globals.css. Requirements: NFR-10 (contrast, readable text), FR-06.
 *
 * The tokens are the UI spec's table (specs/frontend/ui-spec.md, "Design tokens"). Components use them as Tailwind classes
 * (bg-pine, text-ink-soft) and never write a colour by hand; every pair of text and background must be readable.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const GLOBALS_CSS = readFileSync(join(SRC, "styles/globals.css"), "utf8");

// The table of the UI spec. Blue palette: owner's colour change of 2026-10-10 (green became blue).
const SPEC_TOKENS: Record<string, string> = {
  forest: "#1b6f93",
  pine: "#1b6f93",
  "pine-dark": "#134f6a",
  accent: "#1a9fd2",
  amber: "#e8913a",
  paper: "#f6f3ec",
  ink: "#1d2421",
  emergency: "#b3261e",
  "ink-soft": "#4b5c59",
  line: "#d7e1df",
  "pine-100": "#dcecf4",
  "pine-50": "#eef6fa",
  sky: "#a9ddf3", // the home page hero: a real light sky blue (owner, 2026-10-12)
  open: "#147a48",
  "open-bg": "#e7f6ed",
  closed: "#465451",
  "closed-bg": "#edf1f0",
  "amber-ink": "#8b5c00",
  "amber-wash": "#fff4d6",
};

function readTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of GLOBALS_CSS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two colours (1 to 21). */
function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE = "#ffffff";

describe("the tokens of the UI spec", () => {
  it("are all in globals.css, with the values of the spec table", () => {
    expect(readTokens()).toMatchObject(SPEC_TOKENS);
  });

  it("make forest and pine the main blue, and keep the colours the owner did not change", () => {
    const tokens = readTokens();
    expect(tokens.forest).toBe("#1b6f93");
    expect(tokens.pine).toBe("#1b6f93");
    expect(tokens["pine-dark"]).toBe("#134f6a");
    expect(tokens.accent).toBe("#1a9fd2");
    expect(tokens.paper).toBe("#f6f3ec");
    expect(tokens.ink).toBe("#1d2421");
    expect(tokens.emergency).toBe("#b3261e");
    expect(tokens.amber).toBe("#e8913a");
    expect([tokens.open, tokens["open-bg"], tokens.closed, tokens["closed-bg"]]).toEqual([
      "#147a48", "#e7f6ed", "#465451", "#edf1f0",
    ]);
    expect([tokens["amber-ink"], tokens["amber-wash"]]).toEqual(["#8b5c00", "#fff4d6"]);
  });

  it("have a card shadow token made from forest, not from a hand-written colour", () => {
    const shadow = GLOBALS_CSS.match(/--shadow-card:\s*([^;]+);/)?.[1] ?? "";
    expect(shadow).toContain("var(--color-forest)");
    expect(shadow).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});

describe("every text and background pair is readable (at least 4.5:1, NFR-10)", () => {
  const tokens = readTokens();
  const colour = (name: string) => (name === "white" ? WHITE : tokens[name]);

  it.each([
    ["white", "pine", "primary button"],
    ["white", "pine-dark", "primary button on hover and press"],
    ["forest", "pine-100", "Verified label"],
    ["pine-dark", "pine-50", "secondary button text on hover"],
    ["pine-dark", "pine-100", "secondary button text on press"],
    ["white", "forest", "text on the dark header"],
    ["paper", "forest", "paper text on the header"],
    ["forest", "white", "secondary button, headings on a card"],
    ["forest", "paper", "headings and links on the page"],
    ["ink", "paper", "body text"],
    ["ink", "white", "body text on a card"],
    ["ink-soft", "paper", "secondary text on the page"],
    ["ink-soft", "white", "secondary text on a card"],
    ["ink-soft", "pine-50", "secondary text on a light panel"],
    ["ink", "pine-50", "text on a light panel"],
    ["forest", "pine-100", "Verified label"],
    ["forest", "pine-50", "light panel"],
    ["pine-dark", "sky", "the hero heading, line and small line"],
    ["ink", "sky", "dark text on the hero"],
    ["open", "open-bg", "Open now label"],
    ["closed", "closed-bg", "Closed label"],
    ["amber-ink", "amber-wash", "Verification due label"],
    ["white", "emergency", "SwiftRescue button"],
  ])("%s on %s (%s)", (foreground, background) => {
    expect(contrast(colour(foreground), colour(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("the main blue is readable as small text on paper (the old green pine was 4.4:1)", () => {
    expect(contrast(tokens.pine, tokens.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("the sky blue of the hero is light: white text on it would not be readable, so the hero text is dark blue", () => {
    expect(contrast(WHITE, tokens.sky)).toBeLessThan(3);
    expect(contrast(tokens["pine-dark"], tokens.sky)).toBeGreaterThanOrEqual(4.5);
  });

  it("the bright blue accent is not readable as text (3:1), so it is decoration only", () => {
    expect(contrast(tokens.accent, WHITE)).toBeLessThan(4.5);
    expect(contrast(WHITE, tokens.accent)).toBeLessThan(4.5);
  });

  it("the amber of the Sponsored tag stays a background with dark text on it", () => {
    expect(contrast(tokens.ink, tokens.amber)).toBeGreaterThanOrEqual(4.5);
  });

  it("plain amber is not used for the focus ring: it is under 3:1 on white and paper", () => {
    expect(contrast(tokens.amber, WHITE)).toBeLessThan(3);
    expect(contrast(tokens.amber, tokens.paper)).toBeLessThan(3);
  });
});

describe("the focus ring (owner's decision, 2026-10-09; WCAG 2.2 asks for 3:1)", () => {
  const tokens = readTokens();

  it.each(["white", "paper", "pine-50", "pine-100", "sky", "closed-bg", "open-bg"])(
    "forest ring is at least 3:1 on %s",
    (background) => {
      const colour = background === "white" ? WHITE : tokens[background];
      expect(contrast(tokens.forest, colour)).toBeGreaterThanOrEqual(3);
    },
  );

  it("a paper ring is at least 3:1 on a forest background", () => {
    expect(contrast(tokens.paper, tokens.forest)).toBeGreaterThanOrEqual(3);
  });

  it("globals.css draws a 3 px forest ring, and a paper ring inside .on-dark", () => {
    const light = GLOBALS_CSS.match(/:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
    const dark = GLOBALS_CSS.match(/\.on-dark\s+:focus-visible\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(light).toMatch(/outline:\s*3px solid var\(--color-forest\)/);
    expect(light).toMatch(/outline-offset:\s*2px/);
    expect(dark).toMatch(/outline-color:\s*var\(--color-paper\)/);
  });

  it("no focus rule uses amber", () => {
    const focusRules = [...GLOBALS_CSS.matchAll(/[^{}]*:focus-visible\s*\{[^}]*\}/g)].map((match) => match[0]);
    expect(focusRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of focusRules) expect(rule).not.toContain("amber");
  });
});

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("components use tokens, not hand-written colours", () => {
  // The browser's address bar and an installed app's splash screen cannot read a CSS variable, so these two files hold
  // the colour as text. They must stay equal to the tokens.
  const BROWSER_CHROME_FILES = ["app/layout.tsx", "app/manifest.ts"];

  it("no hex or rgb colour is written in the source, except for the browser chrome", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file))
      .filter((file) => !BROWSER_CHROME_FILES.includes(file))
      .filter((file) => /#(?:[0-9a-fA-F]{3}){1,2}\b|\brgba?\(|\bhsla?\(/.test(readFileSync(join(SRC, file), "utf8")));

    expect(offenders).toEqual([]);
  });

  it("the browser chrome colours equal the forest and paper tokens", () => {
    const tokens = readTokens();
    const layout = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    const manifest = readFileSync(join(SRC, "app/manifest.ts"), "utf8");
    expect(layout).toContain(`themeColor: "${tokens.forest}"`);
    expect(manifest).toContain(`theme_color: "${tokens.forest}"`);
    expect(manifest).toContain(`background_color: "${tokens.paper}"`);
  });

  it("the bright blue accent is never a background or a text colour (it is decoration only, such as a border)", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file))
      .filter((file) => /\b(?:bg|text|from|to|via)-accent\b/.test(readFileSync(join(SRC, file), "utf8")));

    expect(offenders).toEqual([]);
  });

  it("buttons darken to pine-dark on hover and press", () => {
    const buttons = readFileSync(join(SRC, "components/ui/buttonStyles.ts"), "utf8");
    expect(buttons).toMatch(/hover:bg-pine-dark/);
    expect(buttons).toMatch(/active:bg-pine-dark/);
    expect(buttons).toMatch(/hover:border-pine-dark/);
  });

  it("no text is smaller than 16 px (no text-xs or text-sm class anywhere)", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file))
      .filter((file) => /\btext-(?:xs|sm|\[(?:1[0-5]|[0-9])px\])\b/.test(readFileSync(join(SRC, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
