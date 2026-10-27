/** Dark mode: the source. Requirements: NFR-10; the owner's request of 2026-10-26 ("every page covered", "the 112 card stays clearly red",
 * "the logo and photos and credits readable", "the Security QR code stays dark on white"). Spec: ui-spec "Dark mode".
 * The colours are tokens, and a token has a ROLE: the ones that change in dark mode (surface, page, ink, forest...) and the ones that never do
 * (pine, paper, white, emergency...). A class that mixes the two the wrong way would be unreadable in one mode, so these tests read the
 * source of every component and refuse the combinations that would break. They cannot see a page; the real-browser run does that.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC);
const read = (path: string) => readFileSync(join(SRC, path), "utf8");
const name = (path: string) => relative(SRC, path);

/** The code without its comments: a comment may name a class it explains. */
function code(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Every string literal of a file that looks like a list of classes. */
function classStrings(path: string): string[] {
  return [...code(path).matchAll(/["'`]([^"'`\n]*(?:\b(?:bg|text|border)-[a-z0-9-]+)[^"'`\n]*)["'`]/g)].map((match) => match[1]);
}

describe("no class takes the wrong side of a role", () => {
  it("has no bg-white: a card, a field or a dialog is bg-surface (white itself never changes, so it was white in the dark)", () => {
    const offenders = FILES.filter((path) => /\bbg-white\b/.test(code(path)));
    expect(offenders.map(name)).toEqual([]);
  });

  it("has no bg-forest: forest is the text blue and changes, a bar with white text is bg-pine", () => {
    const offenders = FILES.filter((path) => /\bbg-forest\b/.test(code(path)));
    expect(offenders.map(name)).toEqual([]);
  });

  it("has no bg-paper (the page is bg-page; paper is the cream text of the blue bars) and no solid black (only a see-through black scrim)", () => {
    const offenders = FILES.filter((path) => /\b(?:bg-paper|bg-black(?!\/)|text-black|border-black)\b/.test(code(path)));
    expect(offenders.map(name)).toEqual([]);
  });

  it("has no text-emergency or border-emergency: red as text or as an edge is alert (it is lighter in the dark); bg-emergency stays", () => {
    const offenders = FILES.filter((path) => /\b(?:text|border|ring|stroke)-emergency\b/.test(code(path)));
    expect(offenders.map(name)).toEqual([]);
  });

  it("puts no white text on a background that changes (white on surface, page, a tint or a wash would vanish in one mode)", () => {
    const changing = /\bbg-(?:surface|page|pine-50|pine-100|open-bg|closed-bg|amber-wash)\b/;
    const offenders = FILES.flatMap((path) =>
      classStrings(path)
        .filter((classes) => /\btext-white\b/.test(classes) && changing.test(classes))
        .map((classes) => `${name(path)}: ${classes}`),
    );
    expect(offenders).toEqual([]);
  });

  it("puts only constant text on a constant background: text on bg-pine, bg-emergency or bg-amber is white, paper or on-amber", () => {
    const flippingText = /\btext-(?:ink|ink-soft|forest|alert|open|closed|amber-ink)\b/;
    const offenders = FILES.flatMap((path) =>
      classStrings(path)
        .filter((classes) => /\bbg-(?:pine|pine-dark|emergency|amber)(?![-\w])/.test(classes) && flippingText.test(classes))
        .map((classes) => `${name(path)}: ${classes}`),
    );
    expect(offenders).toEqual([]);
  });

  it("gives the Sponsored tag (bg-amber) text-on-amber, in the result card and in the map popup", () => {
    for (const file of ["components/listings/ListingCard.tsx", "components/search/MapPopup.tsx"]) {
      const tag = classStrings(join(SRC, file)).find((classes) => /\bbg-amber\b/.test(classes));
      expect(tag, file).toMatch(/\btext-on-amber\b/);
    }
  });
});

describe("the header, the Menu and the layout", () => {
  it("has the Theme button in the bar (HeaderNavigation) and in the Menu (MobileMenu)", () => {
    expect(read("components/layout/HeaderNavigation.tsx")).toMatch(/<ThemeToggle variant="bar" \/>/);
    expect(read("components/layout/MobileMenu.tsx")).toMatch(/<ThemeToggle variant="menu" \/>/);
  });

  it("sets the theme with a script in the head, before the body, and lets the attribute differ between server and browser", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toMatch(/<html lang="en" suppressHydrationWarning>/);
    expect(layout).toMatch(/<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_SCRIPT \}\} \/>\s*<\/head>/);
    expect(layout.indexOf("<head>")).toBeLessThan(layout.indexOf("<body"));
  });

  it("keeps the address-bar colour the header blue in both modes (a constant, not a token that changes)", () => {
    expect(read("app/layout.tsx")).toMatch(/themeColor: "#1b6f93"/);
  });

  it("uses the dark: variant for the outline button's edge on hover, where no token can say it", () => {
    expect(read("components/ui/buttonStyles.ts")).toMatch(/dark:hover:border-forest/);
  });
});

describe("the 112 card, the logo, the QR code, the map and the chart", () => {
  it("keeps the 112 card clearly red in both modes: a red border (alert), the red Call 112 button (emergency, white text), a card surface", () => {
    const card = read("components/emergency/NationalLineCard.tsx");
    expect(card).toMatch(/border-2 border-alert bg-surface/);
    expect(card).toMatch(/bg-emergency[^"]*text-white/);
  });

  it("keeps the red SwiftRescue button of the header the same red in both modes", () => {
    expect(read("components/layout/HeaderNavigation.tsx")).toMatch(/bg-emergency[^"]*text-white/);
  });

  it("draws the logo with constant colours only, so it reads the same on the blue bar in both modes", () => {
    const logo = code(join(SRC, "components/layout/Logo.tsx"));
    expect(logo).not.toMatch(/\b(?:text|fill|stroke|bg)-(?:ink|ink-soft|forest|surface|page|line|pine-50|pine-100)\b/);
    expect(logo).toMatch(/fill-white/);
    expect(logo).toMatch(/text-sky-pale/);
  });

  it("makes the Security QR code with the library's own colours (black on white, a white frame) and never inverts or themes it", () => {
    const setup = code(join(SRC, "components/admin/TwoFactorSetup.tsx"));
    const call = setup.match(/QRCode\.toDataURL\(([^)]*)\)/)?.[1] ?? "";
    expect(call).toMatch(/margin: 2/); // the white frame
    expect(call).not.toMatch(/color|dark|light/); // no colour option: the library draws #000000 on #ffffff
    expect(setup).not.toMatch(/\bdark:|invert|mix-blend|\bfilter\b/);
    const defaults = readFileSync(join(process.cwd(), "node_modules/qrcode/lib/renderer/utils.js"), "utf8");
    expect(defaults).toMatch(/dark: hex2rgba\(options\.color\.dark \|\| '#000000ff'\)/);
    expect(defaults).toMatch(/light: hex2rgba\(options\.color\.light \|\| '#ffffffff'\)/);
  });

  it("draws the map's pins, position dot, popups and credit so they read on the light tiles in both modes", () => {
    const css = readFileSync(join(SRC, "styles/map.css"), "utf8");
    expect(css).toMatch(/\.map-pin__body\s*\{[^}]*fill:\s*var\(--color-pine\)/);
    expect(css).toMatch(/\.map-position-dot\s*\{[^}]*background:\s*var\(--color-pine-dark\)/);
    expect(css).toMatch(/\.leaflet-popup-content-wrapper,\s*\.leaflet-container \.leaflet-popup-tip\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(css).toMatch(/\.leaflet-control-attribution\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(css).not.toMatch(/background:\s*var\(--color-white\)/);
  });

  it("draws the dashboard chart with tokens, so its failed bars, axes and grid read in both modes", () => {
    const chart = read("components/admin/CheckChart.tsx");
    expect(chart).toMatch(/FAILED_COLOUR = "var\(--color-alert\)"/);
    expect(chart).toMatch(/GRID_COLOUR = "var\(--color-line\)"/);
    expect(chart).toMatch(/fill: "var\(--color-ink-soft\)"/);
    expect(chart).toMatch(/stroke=\{GRID_COLOUR\}/);
    expect(chart).not.toMatch(/var\(--color-emergency\)|bg-emergency/);
  });
});

describe("no page keeps its own colour scheme", () => {
  it("has no file outside globals.css that sets prefers-color-scheme or color-scheme", () => {
    const offenders = FILES.filter((path) => /prefers-color-scheme|color-scheme/.test(code(path)));
    // the theme files name the media query on purpose (lib/theme)
    expect(offenders.map(name).filter((file) => !file.startsWith("lib/theme/"))).toEqual([]);
  });
});
