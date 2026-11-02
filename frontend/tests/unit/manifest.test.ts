/** The web app manifest. Requirements: NFR-03 ("installable web app"), NFR-04, FR-02, FR-17. Spec: specs/2026-11-02-installable-pwa/.
 * Chrome (and Edge, Samsung Internet) offer "Install" when the manifest has a name, a start address, display "standalone" (or another
 * app-like mode) and a 192 px and a 512 px icon, and the page has a service worker with a fetch handler. The shortcuts are what a long
 * press on the installed icon shows. The icons themselves are in appIcons.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

const SOURCE = readFileSync(join(process.cwd(), "src", "app", "manifest.ts"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

describe("the names", () => {
  it("is called SwiftHealth Route, and SwiftHealth under the icon on a phone (short_name)", () => {
    expect(manifest().name).toBe("SwiftHealth Route");
    expect(manifest().short_name).toBe("SwiftHealth");
    expect(manifest().name).toBe(brand.name); // the name is written once, in config/brand.ts
    expect(manifest().short_name).toBe(brand.main);
  });

  it("has a description, from the same words as the page description, and no city", () => {
    const description = manifest().description ?? "";

    expect(description).toContain(siteConfig.tagline);
    expect(description.length).toBeGreaterThan(40);
    expect(description).not.toContain(siteConfig.launchCity);
  });

  it("writes no name of its own in the file: it reads brand.ts", () => {
    expect(SOURCE).not.toMatch(/SwiftHealth/);
  });
});

describe("how the installed app opens", () => {
  it("starts at the home page, in a window of its own (standalone), and its scope is the whole site", () => {
    expect(manifest().start_url).toBe("/");
    expect(manifest().display).toBe("standalone");
    expect(manifest().scope).toBe("/");
    expect(manifest().id).toBe("/");
  });

  it("is in English", () => {
    expect(manifest().lang).toBe("en");
  });

  it("uses the Light-mode colours: the paper of the pages for the start screen and the header blue for the bar", () => {
    expect(manifest().background_color).toBe("#f6f3ec");
    expect(manifest().theme_color).toBe("#1b6f93");
  });

  it("has the same theme colour as the browser bar of the pages (viewport.themeColor)", () => {
    expect(LAYOUT).toContain(`themeColor: "${manifest().theme_color}"`);
  });
});

describe("the shortcuts (a long press on the installed icon)", () => {
  const shortcuts = manifest().shortcuts ?? [];

  it("has SwiftRescue to /emergency first, and Find care to /find second", () => {
    expect(shortcuts.map((shortcut) => [shortcut.name, shortcut.url])).toEqual([
      [brand.emergencyName, "/emergency"],
      ["Find care", "/find"],
    ]);
  });

  it("gives each a short name, a description and an icon, and keeps every address inside the scope", () => {
    for (const shortcut of shortcuts) {
      expect(shortcut.short_name?.length ?? 0).toBeGreaterThan(0);
      expect(shortcut.description?.length ?? 0).toBeGreaterThan(10);
      expect(shortcut.icons?.length ?? 0).toBeGreaterThan(0);
      expect(shortcut.url.startsWith("/")).toBe(true);
      expect(shortcut.url).not.toMatch(/lat=|lng=|\?/); // never a position, never a query
    }
  });

  it("matches the links of the header: SwiftRescue and Find care are the same addresses", () => {
    expect(shortcuts[0].url).toBe(siteConfig.emergencyLink.href);
    expect(shortcuts[1].url).toBe(siteConfig.findCareLink.href);
  });

  it("makes no medical claim in a description", () => {
    for (const shortcut of shortcuts) {
      expect(shortcut.description).not.toMatch(/diagnos|treat(ment)?\b|cure\b|medical advice|guarantee/i);
    }
  });
});

describe("the page head", () => {
  it("links the Apple touch icon through the file src/app/apple-icon.png, and tells iPhone the site is a web app with the short name", () => {
    expect(LAYOUT).toMatch(/appleWebApp:\s*\{[^}]*capable:\s*true/);
    expect(LAYOUT).toMatch(/appleWebApp:\s*\{[^}]*title:\s*brand\.main/);
  });
});
