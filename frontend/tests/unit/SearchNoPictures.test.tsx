// @vitest-environment jsdom
/** The search page has no pictures at all. Requirements: US-01, NFR-01, NFR-13. Spec: specs/2026-10-22-home-photos/requirements.md part 1,
 * ui-spec 2.3. The type banners (clinic, laboratory, pharmacy) and their "Designed by Magnific" credits of specs/2026-10-15-find-by-type/ are gone:
 * with or without a type, the page shows the heading, the chip, the search box and the results, and no photo, no illustration, no credit.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/(public)/search/page";
import { resetMetaCache } from "@/lib/api/meta";

import { json, listing, stubApi } from "../helpers/api";
import { installDialogSupport } from "../helpers/dialog";
import { stubGeolocationPermission } from "../helpers/permission";

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

describe("the search page has no pictures", () => {
  it.each(["", "category=clinic", "category=pharmacy", "category=laboratory", "category=hospital", "category=maternity"])(
    "shows no img, picture, figure, background photo or credit for '%s'",
    async (query) => {
      navigation.query = query;
      stubApi({ search: () => json({ items: [listing()], total: 1 }) });
      const { container } = render(<SearchPage />);
      await screen.findByRole("article");

      expect(container.querySelectorAll("img, picture, figure, video, canvas")).toHaveLength(0);
      expect(container.innerHTML).not.toMatch(/background-image|\/images\//);
      expect(screen.queryByText(/Designed by Magnific/)).toBeNull();
      expect(screen.queryByRole("link", { name: /magnific/i })).toBeNull();
    },
  );

  it("still shows the heading, the chip and the result for a type", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: () => json({ items: [listing()], total: 1 }) });
    render(<SearchPage />);
    await screen.findByRole("article");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Pharmacies/);
    expect(screen.getByRole("button", { name: "Remove the Pharmacy filter" })).toBeTruthy();
  });
});
