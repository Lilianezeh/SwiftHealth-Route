/** robots.txt and sitemap.xml. Requirements: NFR-12 (SEO). Decision D7 in specs/2026-10-20-info-pages/requirements.md. */
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";

describe("robots.txt", () => {
  it("allows everything except the staff and provider areas, and names the sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(["/admin/", "/provider/"]);
    expect(result.sitemap).toBe(`${siteConfig.siteUrl}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists the static public pages on the production address", () => {
    expect(entries.map((entry) => entry.url).sort()).toEqual(
      ["", "/find", "/emergency", "/about", "/how-we-verify", "/privacy", "/terms", "/contact", "/list-your-facility"]
        .map((path) => `${siteConfig.siteUrl}${path}`)
        .sort(),
    );
  });

  it("never lists a staff, provider, search or report address", () => {
    for (const entry of entries) expect(entry.url).not.toMatch(/\/(admin|provider|search|report|listing)\b/);
  });

  it("uses https and no query string, no position", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith("https://")).toBe(true);
      expect(entry.url).not.toMatch(/\?|lat=|lng=/);
    }
  });
});
