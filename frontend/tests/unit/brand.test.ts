/** The brand name lives in one file. Requirements: US-13, NFR-10. UI spec, "Brand and naming"; revision R35 (2026-10-13) in
 * specs/2026-10-11-home-redesign/requirements.md. The owner renamed the app to SwiftHealth Route; SwiftRescue stays.
 */
import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";
import manifest from "@/app/manifest";
import { brand } from "@/config/brand";
import { HOME_WORDS } from "@/config/home";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

// The code without its comments: a comment may say what the old name was.
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the brand config (src/config/brand.ts)", () => {
  it("has the name SwiftHealth Route, made of the two parts of the wordmark, and the unchanged SwiftRescue", () => {
    expect(brand.name).toBe("SwiftHealth Route");
    expect(brand.main).toBe("SwiftHealth");
    expect(brand.accent).toBe("Route");
    expect(`${brand.main} ${brand.accent}`).toBe(brand.name);
    expect(brand.emergencyName).toBe("SwiftRescue");
  });

  it("is the only file that writes the name: the other files read it from here", () => {
    for (const file of [
      "app/layout.tsx",
      "app/manifest.ts",
      "config/site.ts",
      "config/home.ts",
      "components/layout/SiteFooter.tsx",
      "components/layout/SiteHeader.tsx",
      "components/layout/HeaderNavigation.tsx",
      "components/layout/Logo.tsx",
    ]) {
      expect(withoutComments(readSource(file)), file).not.toMatch(/SwiftHealth|SwiftRescue/);
    }
    expect(withoutComments(readSource("config/brand.ts"))).toMatch(/SwiftHealth/);
  });
});

describe("the name on screen and in the metadata", () => {
  it("is the site name, the page title, the description and the manifest names", () => {
    expect(siteConfig.name).toBe("SwiftHealth Route");
    expect(metadata.title).toBe("SwiftHealth Route");
    expect(String(metadata.description)).toContain("SwiftHealth Route");
    expect(manifest().name).toBe("SwiftHealth Route");
    expect(manifest().short_name).toBe("SwiftHealth Route");
  });

  it("says the new name in the Overview text, and the old name SwiftHealth alone nowhere in the words of the home page", () => {
    expect(HOME_WORDS.overview.text.startsWith("SwiftHealth Route helps you find")).toBe(true);
    const everyWord = JSON.stringify(HOME_WORDS);
    expect(everyWord.match(/SwiftHealth(?! Route)/g)).toBeNull();
  });

  it("keeps SwiftRescue as the emergency name and the label of the red button's link", () => {
    expect(siteConfig.emergencyName).toBe("SwiftRescue");
    expect(siteConfig.emergencyLink).toEqual({ label: "SwiftRescue", href: "/emergency" });
  });

  it("keeps the old name only where the owner asked: the repo, the folders, the Netlify address, the API's own title", () => {
    // Nothing in the frontend source (without comments) writes a bare "SwiftHealth" string outside brand.ts and the file names.
    for (const file of ["app/layout.tsx", "app/manifest.ts", "config/site.ts"]) {
      expect(withoutComments(readSource(file)), file).not.toMatch(/["'`]SwiftHealth["'`]/);
    }
  });
});
