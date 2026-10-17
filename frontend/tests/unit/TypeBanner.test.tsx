// @vitest-environment jsdom
/** The photo banner of the results page. Requirements: US-01, NFR-01, NFR-07, NFR-10, NFR-13. Spec: specs/2026-10-15-find-by-type/requirements.md D6.
 * The banner shows only for a type with an approved photo (clinic, laboratory, pharmacy), under the heading, with the credit "Designed by
 * Magnific" next to it. Hospital and maternity have no photo yet: they get the heading and the chip, and no banner and no credit.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/(public)/search/page";
import { resetMetaCache } from "@/lib/api/meta";

import { json, listing, stubApi } from "../helpers/api";
import { installDialogSupport } from "../helpers/dialog";
import { stubGeolocationPermission } from "../helpers/permission";
import { readSource } from "../helpers/source";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

beforeEach(() => {
  installDialogSupport();
  window.sessionStorage.clear();
  resetMetaCache();
  navigation.replace.mockReset();
  navigation.push.mockReset();
  navigation.query = "";
  stubGeolocationPermission("unsupported");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ONE_RESULT = () => json({ items: [listing()], total: 1 });

function banners(container: HTMLElement): HTMLImageElement[] {
  return [...container.querySelectorAll<HTMLImageElement>("img[src^='/images/types/']")];
}

describe("the type banner", () => {
  it.each(["clinic", "laboratory", "pharmacy"])("shows one photo for %s, with fixed size, alt text and the credit next to it", async (slug) => {
    navigation.query = `category=${slug}`;
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    const found = banners(container);
    expect(found).toHaveLength(1);
    expect(found[0].getAttribute("src")).toBe(`/images/types/banner-${slug}-1.webp`);
    expect(found[0]).toHaveAttribute("width", "960");
    expect(found[0]).toHaveAttribute("height", "320");
    expect(found[0].alt.length).toBeGreaterThan(10);
    expect(found[0].className).toMatch(/\bh-auto\b/);
    expect(found[0].className).toMatch(/\bw-full\b/);
  });

  it("downloads only the chosen type's photo: one image of the folder, none for the other types", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/banner-(clinic|laboratory)/);
  });

  it("shows the credit 'Designed by Magnific' under the banner, as a safe link to www.magnific.com in a new tab", async () => {
    navigation.query = "category=laboratory";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    expect(credit).toHaveAttribute("href", "https://www.magnific.com");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit.getAttribute("rel")).toContain("noopener");
    expect(credit.getAttribute("rel")).toContain("noreferrer");
    expect(credit).toHaveTextContent("(opens in a new tab)");
    expect(credit.className).toMatch(/\bmin-h-12\b/);
    expect(credit.className).toMatch(/\btext-base\b/);
    expect(banners(container)[0].compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the credit text at 16 px but sits it tight under the photo, with the 48 px tap area reaching down below the text (owner, 2026-10-17)", async () => {
    navigation.query = "category=laboratory";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    const credit = screen.getByRole("link", { name: /^Designed by Magnific/ });
    expect(credit.className).toMatch(/\btext-base\b/); // 16 px: the rule of NFR-10 stays
    expect(credit.className).not.toMatch(/\btext-(xs|sm)\b/);
    expect(credit.className).toMatch(/\bmin-h-12\b/); // the tap area is still 48 px
    expect(credit.className).toMatch(/\bitems-start\b/); // the text is at the top of that area, next to the photo
    expect(credit.className).not.toMatch(/\bitems-center\b/);
    expect(credit.className).toMatch(/\bpt-0\.5\b|\bpt-1\b/); // a hair of space, not a gap
    // The credit follows the photo straight away, with no gap between them.
    const wrapper = banners(container)[0].parentElement as HTMLElement;
    expect(wrapper.className).not.toMatch(/\bgap-(1|2|3|4)\b/);
    expect(banners(container)[0].nextElementSibling).toBe(credit);
  });

  it("is the same 3:1 picture on a phone (its height follows its width) and about 140 px high from 768 px, cropped, not squeezed", async () => {
    navigation.query = "category=clinic";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    const photo = banners(container)[0];
    expect(photo.className).toMatch(/(^|\s)h-auto(\s|$)/); // phone: as it was, the height follows the width (3:1)
    expect(photo.className).toMatch(/\bw-full\b/);
    expect(photo.className).toMatch(/\bmd:h-\[140px\]/); // tablet and laptop: about half the old height
    expect(photo.className).toMatch(/\bmd:object-cover\b/); // cropped to fit, never stretched
    expect(photo).toHaveAttribute("width", "960"); // the file and its size are unchanged
    expect(photo).toHaveAttribute("height", "320");
  });

  it("says which part of each photo stays in the crop: the face, as a CSS object-position from the config", async () => {
    for (const slug of ["clinic", "laboratory", "pharmacy"]) {
      navigation.query = `category=${slug}`;
      stubApi({ search: ONE_RESULT });
      const { container, unmount } = render(<SearchPage />);
      await screen.findByRole("article");

      expect(banners(container)[0].style.objectPosition, slug).toMatch(/^\d+% \d+%$/);
      unmount();
    }
  });

  it("is in this order: heading, banner, credit, search box, chip, Filters", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    const ordered = [
      screen.getByRole("heading", { level: 1 }),
      banners(container)[0],
      screen.getByRole("link", { name: /^Designed by Magnific/ }),
      screen.getByRole("search"),
      screen.getByRole("button", { name: "Remove the Pharmacy filter" }),
      screen.getByRole("button", { name: "Filters" }),
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      expect(
        ordered[index - 1].compareDocumentPosition(ordered[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
        `item ${index} should come after item ${index - 1}`,
      ).toBeTruthy();
    }
  });

  it("puts no text on the photo: the heading is above it and the credit is beside it, never over it", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    expect(container.querySelector("[class*='absolute']")).toBeNull();
    expect(readSource("components/search/TypeBanner.tsx")).not.toMatch(/\babsolute\b/);
  });

  it.each(["hospital", "maternity"])("shows no banner and no credit for %s, which has no approved photo, but keeps the heading and the chip", async (slug) => {
    navigation.query = `category=${slug}`;
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: /Magnific/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Remove the .* filter$/ })).toBeInTheDocument();
  });

  it("shows no banner and no credit without a type, or for a category outside the five", async () => {
    for (const query of ["", "category=ambulance", "q=hospital+ogui"]) {
      navigation.query = query;
      stubApi({ search: ONE_RESULT });
      const { container, unmount } = render(<SearchPage />);
      await screen.findByRole("article");

      expect(container.querySelectorAll("img"), query).toHaveLength(0);
      expect(screen.queryByRole("link", { name: /Magnific/ }), query).not.toBeInTheDocument();
      unmount();
    }
  });

  it("does not make the results wait for the picture: the results and the chip show without the image having loaded", async () => {
    navigation.query = "category=clinic";
    stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);

    // jsdom never loads an image, and the results and the chip are there all the same.
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(banners(container)[0].complete).toBe(false);
    expect(screen.getByRole("button", { name: "Remove the Clinic filter" })).toBeInTheDocument();
  });

  it("adds no position to the page or to the search (NFR-07)", async () => {
    navigation.query = "category=pharmacy";
    const { searches } = stubApi({ search: ONE_RESULT });
    const { container } = render(<SearchPage />);
    await screen.findByRole("article");

    expect(container.innerHTML).not.toMatch(/lat=|lng=/);
    expect(searches()[0].searchParams.has("lat")).toBe(false);
  });
});
