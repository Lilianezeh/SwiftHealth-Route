/** The offline page (public/offline.html). Requirements: FR-17, NFR-03, NFR-04, NFR-07, NFR-10. Spec: specs/2026-11-02-installable-pwa/.
 * The service worker shows it when a page cannot be reached: "You're offline. SwiftRescue still works: call 112." It is plain HTML with
 * its own few lines of CSS, because it is shown with no network: nothing outside the file (no script, no font, no picture, no request),
 * 16 px text, 48 px buttons, one column that fits 320 px, and the colours of the Light and the Dark mode (the same choice as the site:
 * Light unless the visitor chose Dark, kept in localStorage under the theme key, read in a try/catch).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { brand } from "@/config/brand";
import { THEME_KEY } from "@/lib/theme/theme";

const HTML = readFileSync(join(process.cwd(), "public", "offline.html"), "utf8");
const TEXT = HTML.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("what it says", () => {
  it("says exactly: You're offline. SwiftRescue still works: call 112.", () => {
    expect(HTML).toContain("You're offline. SwiftRescue still works: call 112.");
  });

  it("has one h1, with the name of the app", () => {
    expect(HTML.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(HTML).toContain(brand.name);
    expect(HTML).toMatch(/<title>[^<]*Offline[^<]*<\/title>/);
  });

  it("has a Call 112 link (tel:112, the only number on the page), a link to SwiftRescue, and a Try again button", () => {
    expect(HTML).toMatch(/<a[^>]+href="tel:112"[^>]*>\s*Call 112\s*<\/a>/);
    expect(HTML).toMatch(/<a[^>]+href="\/emergency"[^>]*>\s*Open SwiftRescue\s*<\/a>/);
    expect(HTML).toMatch(/<button[^>]*>\s*Try again\s*<\/button>/);
    expect(TEXT.match(/\d{3,}/g)).toEqual(["112", "112"]); // only 112 (in the sentence and on the link): no other number
  });

  it("gives no medical advice and makes no claim about what works offline except SwiftRescue", () => {
    expect(TEXT).not.toMatch(/diagnos|treat(ment)?\b|cure\b|medical advice|guarantee/i);
  });
});

describe("what it needs", () => {
  it("is a complete page in English with the viewport tag, so it fits a phone", () => {
    expect(HTML.trimStart().toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(HTML).toMatch(/<html[^>]+lang="en"/);
    expect(HTML).toMatch(/<meta[^>]+name="viewport"[^>]+width=device-width/);
    expect(HTML).toMatch(/<meta charset="utf-8">/i);
  });

  it("asks for nothing from the network: no address of another file, no picture, no font, no external script or style", () => {
    expect(HTML).not.toMatch(/\bsrc\s*=/i);
    expect(HTML).not.toMatch(/<link[^>]+rel=["']?(stylesheet|preload|icon)/i);
    expect(HTML).not.toMatch(/url\(|@import|https?:\/\//i);
    expect(HTML).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|analytics/i);
  });

  it("is kept small: a few kilobytes", () => {
    expect(Buffer.byteLength(HTML)).toBeLessThan(6_000);
  });

  it("does not keep, send or read anything about the visitor: no position, no cookie, no session", () => {
    expect(HTML).not.toMatch(/geolocation|document\.cookie|sessionStorage|navigator\.(?!onLine)/i);
  });
});

describe("how it looks", () => {
  it("has text of 16 px or more, and buttons and links of 48 px or more", () => {
    const sizes = [...HTML.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)].map(([, value, unit]) => (unit === "rem" ? Number(value) * 16 : Number(value)));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
    expect(HTML).toMatch(/min-height:\s*(48|50|3rem)/);
  });

  it("is one column that fits 320 px: no fixed width, a maximum width instead", () => {
    expect(HTML).not.toMatch(/[^-]width:\s*\d{3,}px/);
    expect(HTML).toMatch(/max-width:/);
    expect(HTML).not.toMatch(/overflow-x:\s*scroll/);
  });

  it("uses the Light colours of the site (paper and ink) and the Dark ones under data-theme=dark", () => {
    expect(HTML).toContain("#f6f3ec"); // paper
    expect(HTML).toContain("#1d2421"); // ink
    expect(HTML).toContain("#1b6f93"); // the header blue, for the buttons
    expect(HTML).toMatch(/\[data-theme="dark"\]/);
    expect(HTML).toContain("#060d18"); // the dark page
    expect(HTML).toContain("#eaf1fa"); // the dark ink
  });

  it("makes the Call 112 link the red of SwiftRescue, in both modes, with white text", () => {
    expect(HTML).toMatch(/\.call\s*\{[^}]*background:\s*#b3261e[^}]*color:\s*#ffffff/);
  });

  it("follows the visitor's choice of theme like the site: reads the same key in a try/catch, and Light when there is none", () => {
    expect(HTML).toContain(`"${THEME_KEY}"`);
    expect(HTML).toMatch(/try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/);
    expect(HTML).not.toMatch(/@media\s*\(prefers-color-scheme/); // Light unless the visitor chose Dark (the site's own rule)
  });
});
