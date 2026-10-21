/** The titles, descriptions and the staff pages' noindex. Requirements: NFR-12 (SEO), NFR-10, FR-23. UI spec 2.10 ("Skip link and
 * titles"); decisions D6 and D7 in specs/2026-10-20-info-pages/requirements.md.
 */
import { describe, expect, it } from "vitest";

import { metadata as rootMetadata } from "@/app/layout";
import { metadata as dashboardMetadata } from "@/app/(dashboards)/layout";
import { metadata as bloodMetadata } from "@/app/(public)/blood/page";
import { metadata as donateMetadata } from "@/app/(public)/blood/donate/page";
import { metadata as emergencyMetadata } from "@/app/(public)/emergency/page";
import { metadata as findMetadata } from "@/app/(public)/find/page";
import { metadata as listMetadata } from "@/app/(public)/list-your-facility/page";
import { metadata as listingMetadata } from "@/app/(public)/listing/[slug]/page";
import { metadata as reportMetadata } from "@/app/(public)/report/[slug]/page";
import { metadata as searchMetadata } from "@/app/(public)/search/page";
import { brand } from "@/config/brand";

describe("the title template", () => {
  it("is 'Page | SwiftHealth Route' with the name from the brand file, and the plain name for the home page", () => {
    expect(rootMetadata.title).toEqual({ default: brand.name, template: `%s | ${brand.name}` });
  });
});

describe("every public page has its own title and a description", () => {
  it.each([
    ["find", findMetadata, "Find care"],
    ["search", searchMetadata, "Search"],
    ["emergency", emergencyMetadata, "SwiftRescue"],
    ["list your facility", listMetadata, "List your facility"],
    ["blood", bloodMetadata, "Find blood"],
    ["donate blood", donateMetadata, "Donate blood"],
    ["listing", listingMetadata, "Listing"],
    ["report", reportMetadata, "Report a problem"],
  ] as const)("%s", (_name, metadata, title) => {
    expect(metadata.title).toBe(title);
    expect(String(metadata.description ?? "").length).toBeGreaterThan(20);
  });
});

describe("the staff and provider pages", () => {
  it("are not indexed and not followed", () => {
    expect(dashboardMetadata.robots).toEqual({ index: false, follow: false });
    expect(dashboardMetadata.title).toBe("Staff area");
  });
});
