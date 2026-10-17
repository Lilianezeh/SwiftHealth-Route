// @vitest-environment jsdom
/** A chosen type on the results page: the heading, the chip and the typed type words.
 * Requirements: US-01, US-05, FR-04, FR-05, NFR-04, NFR-07, NFR-10. Spec: specs/2026-10-15-find-by-type/requirements.md D2 to D5
 * (the owner's points 3 and 11, and the headings of 2026-10-15). Tests for the banner (D6) are in TypeBanner.test.tsx.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/(public)/search/page";
import { resetMetaCache } from "@/lib/api/meta";
import { savePosition } from "@/lib/location/locationStore";

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ONE_PHARMACY = () => json({ items: [listing()], total: 1 });

/** The address the page was sent to by `router.replace`, as a plain object, or null when it was not called. */
function replacedAddress(): { path: string; parameters: Record<string, string> } | null {
  if (navigation.replace.mock.calls.length === 0) return null;
  const address = String(navigation.replace.mock.calls.at(-1)?.[0]);
  const [path, query = ""] = address.split("?");
  return { path, parameters: Object.fromEntries(new URLSearchParams(query)) };
}

describe("the heading (D3)", () => {
  it("is 'Search results' with no type chosen, and there is no chip", async () => {
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Search results" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove the/ })).not.toBeInTheDocument();
  });

  it.each([
    ["hospital", "Hospitals near you"],
    ["clinic", "Clinics near you"],
    ["maternity", "Maternity homes near you"],
    ["pharmacy", "Pharmacies near you"],
    ["laboratory", "Laboratories near you"],
  ])("says '%s' -> '%s' when the results are sorted from the visitor's position", async (slug, heading) => {
    navigation.query = `category=${slug}`;
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.queryByText("Search results")).not.toBeInTheDocument();
  });

  it("says just the plural when there is no position and no area (no 'near you')", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Pharmacies" })).toBeInTheDocument();
    expect(screen.queryByText(/near you/)).not.toBeInTheDocument();
  });

  it("says 'in <Area>' for a chosen area, and the area wins over a position", async () => {
    navigation.query = "category=pharmacy&area=Ogui";
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Pharmacies in Ogui" })).toBeInTheDocument();
  });

  it("stays 'Search results' for a category outside the five, and the chip still shows with its real name", async () => {
    navigation.query = "category=ambulance";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Search results" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Remove the Ambulance filter" })).toBeInTheDocument();
  });

  it("shows a chip with the slug itself for a category that nobody knows", async () => {
    navigation.query = "category=nothing-here";
    stubApi({ search: () => json({ items: [], total: 0 }) });
    render(<SearchPage />);

    expect(await screen.findByRole("button", { name: "Remove the nothing-here filter" })).toBeInTheDocument();
  });

  it("is one h1, and the page does not show the words 'Search results' while the address is being read", () => {
    const source = readSource("app/(public)/search/page.tsx");
    const code = source.slice(source.indexOf("import")); // after the comment at the top, which names the words

    expect(source).not.toMatch(/["']use client["']/); // still a server page
    expect(code).toMatch(/fallback=\{<WaitingForTheAddress/);
    expect(code).not.toContain("Search results"); // a grey placeholder bar, not the plain heading
    expect(code).toContain("Loading results"); // for screen readers only
  });

  it("puts the position nowhere in the heading", async () => {
    navigation.query = "category=pharmacy";
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: ONE_PHARMACY });
    const { container } = render(<SearchPage />);

    await screen.findByRole("heading", { level: 1, name: "Pharmacies near you" });

    expect(container.innerHTML).not.toMatch(/6\.101|7\.202/);
  });
});

describe("the chip (D4)", () => {
  it("shows the type under the search box, with its name 'Remove the Pharmacy filter' and an icon hidden from screen readers", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    const chip = await screen.findByRole("button", { name: "Remove the Pharmacy filter" });

    expect(chip).toHaveTextContent("Pharmacy");
    expect(chip.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    const searchBox = screen.getByRole("search");
    expect(searchBox.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filters" }).compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("is a button of at least 48 px with 16 px text, in the colour tokens and never red", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    const chip = await screen.findByRole("button", { name: "Remove the Pharmacy filter" });

    expect(chip.tagName).toBe("BUTTON");
    expect(chip.className).toMatch(/\bmin-h-12\b/);
    expect(chip.className).toMatch(/\btext-base\b/);
    expect(chip.className).not.toMatch(/emergency|red/);
  });

  it("removes only the category on a tap: the text, area, service, open now, 24 hours, distance and the map view stay", async () => {
    navigation.query = "category=pharmacy&q=night&area=Ogui&service=X-ray&open_now=true&is_24_hours=true&radius_km=10&view=map";
    stubApi({ search: () => json({ items: [], total: 0 }) }); // no result, so the map code is not loaded
    render(<SearchPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove the Pharmacy filter" }));

    const address = replacedAddress();
    expect(address?.path).toBe("/search");
    expect(address?.parameters).toEqual({
      q: "night", area: "Ogui", service: "X-ray", open_now: "true", is_24_hours: "true", radius_km: "10", view: "map",
    });
    expect(navigation.push).not.toHaveBeenCalled(); // replaced, no history entry
  });

  it("goes back to a plain /search when the type was the only thing in the address", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove the Pharmacy filter" }));

    expect(navigation.replace).toHaveBeenCalledWith("/search");
  });

  it("moves focus to the heading and announces 'Pharmacy filter removed' politely", async () => {
    navigation.query = "category=pharmacy";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);
    const heading = await screen.findByRole("heading", { level: 1 });

    await userEvent.click(await screen.findByRole("button", { name: "Remove the Pharmacy filter" }));

    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveFocus();
    const announcement = screen.getByText("Pharmacy filter removed");
    expect(announcement).toHaveAttribute("role", "status");
    expect(announcement).toHaveAttribute("aria-live", "polite");
  });

  it("agrees with the Filters sheet: the category it shows is the chosen type", async () => {
    navigation.query = "category=laboratory";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);
    await screen.findByRole("button", { name: "Remove the Laboratory filter" });

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    await within(dialog).findByRole("option", { name: "Laboratory" });

    expect(within(dialog).getByRole("combobox", { name: "Category" })).toHaveValue("laboratory");
  });

  it("adds nothing to the address and sends no position", async () => {
    navigation.query = "category=pharmacy";
    savePosition({ latitude: 6.101, longitude: 7.202 });
    const { searches } = stubApi({ search: ONE_PHARMACY });
    const { container } = render(<SearchPage />);
    await screen.findByRole("button", { name: "Remove the Pharmacy filter" });

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toMatch(/6\.101|7\.202/);
    expect(searches()).toHaveLength(1);
    expect(searches()[0].searchParams.get("category")).toBe("pharmacy");
  });
});

describe("a typed type word (D5)", () => {
  it("makes one search with the category and no text, then replaces the address with ?category=pharmacy", async () => {
    navigation.query = "q=pharmacy";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()).toHaveLength(1); // one request, not two
    expect(searches()[0].searchParams.get("category")).toBe("pharmacy");
    expect(searches()[0].searchParams.has("q")).toBe(false);
    expect(navigation.replace).toHaveBeenCalledWith("/search?category=pharmacy");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("shows the type's heading and chip at once, with an empty search box", async () => {
    navigation.query = "q=chemist";
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Pharmacies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove the Pharmacy filter" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("works with plurals, capitals and spacing: 'Drug  Stores' is a pharmacy", async () => {
    navigation.query = "q=Drug++Stores";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()[0].searchParams.get("category")).toBe("pharmacy");
  });

  it("keeps the other filters and the view when it applies a type", async () => {
    navigation.query = "q=lab&open_now=true&area=Ogui&view=map";
    const { searches } = stubApi({ search: () => json({ items: [], total: 0 }) }); // no result, so the map code is not loaded
    render(<SearchPage />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());

    expect(replacedAddress()?.parameters).toEqual({ category: "laboratory", open_now: "true", area: "Ogui", view: "map" });
    expect(searches()).toHaveLength(1);
    expect(Object.fromEntries(searches()[0].searchParams)).toMatchObject({ category: "laboratory", open_now: "true", area: "Ogui" });
  });

  it("leaves 'pharmacy ogui' as a text search: no category, no change of address", async () => {
    navigation.query = "q=pharmacy+ogui";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()[0].searchParams.get("q")).toBe("pharmacy ogui");
    expect(searches()[0].searchParams.has("category")).toBe(false);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Search results" })).toBeInTheDocument();
  });

  it("leaves SwiftRescue words alone: 'ambulance' stays a text search", async () => {
    navigation.query = "q=ambulance";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()[0].searchParams.get("q")).toBe("ambulance");
    expect(searches()[0].searchParams.has("category")).toBe(false);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("replaces a chosen type with a different typed type (the visitor said it last)", async () => {
    navigation.query = "q=hospital&category=pharmacy";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()).toHaveLength(1);
    expect(searches()[0].searchParams.get("category")).toBe("hospital");
    expect(navigation.replace).toHaveBeenCalledWith("/search?category=hospital");
    expect(await screen.findByRole("button", { name: "Remove the Hospital filter" })).toBeInTheDocument();
  });

  it("only clears the text when the typed type is the one already chosen", async () => {
    navigation.query = "category=pharmacy&q=pharmacies";
    const { searches } = stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(searches()).toHaveLength(1);
    expect(searches()[0].searchParams.get("category")).toBe("pharmacy");
    expect(searches()[0].searchParams.has("q")).toBe(false);
    expect(navigation.replace).toHaveBeenCalledWith("/search?category=pharmacy");
  });

  it("never writes the position into the replaced address", async () => {
    navigation.query = "q=pharmacy";
    savePosition({ latitude: 6.101, longitude: 7.202 });
    stubApi({ search: ONE_PHARMACY });
    render(<SearchPage />);

    await screen.findByRole("article");

    expect(String(navigation.replace.mock.calls.at(-1)?.[0])).not.toMatch(/lat|lng|6\.101|7\.202/);
  });
});
