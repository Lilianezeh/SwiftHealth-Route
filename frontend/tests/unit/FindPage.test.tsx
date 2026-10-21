// @vitest-environment jsdom
/** Tests for the /find page and the /blood stub. Requirements: FR-01, FR-03, US-01, NFR-04, NFR-10. UI spec 2.2. */
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FindPage from "@/app/(public)/find/page";
import { resetMetaCache } from "@/lib/api/meta";

import { stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  window.sessionStorage.clear();
  resetMetaCache();
  stubApi({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/find", () => {
  it("has one h1, 'What do you need?'", () => {
    render(<FindPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What do you need?");
  });

  it("has the two large buttons: find a facility (to the search box) and get emergency help (/emergency)", () => {
    render(<FindPage />);

    const find = screen.getByRole("link", { name: "Find a healthcare facility" });
    expect(find).toHaveAttribute("href", "#search");
    expect(document.getElementById("search")).not.toBeNull();

    const emergency = screen.getByRole("link", { name: "Get emergency help" });
    expect(emergency).toHaveAttribute("href", "/emergency");
    expect(emergency.className).toMatch(/\bbg-emergency\b/);
  });

  it("has the search box, inside the section the first button points to", () => {
    render(<FindPage />);

    const section = document.getElementById("search") as HTMLElement;
    expect(within(section).getByRole("search")).toBeInTheDocument();
  });

  it("has the category shortcuts and the Near you part", async () => {
    render(<FindPage />);

    expect(screen.getByRole("navigation", { name: "Categories" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open now near me" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Show places near me" })).toBeInTheDocument();
  });

  it("is in this order: heading, buttons, search box, shortcuts, near me", () => {
    const { container } = render(<FindPage />);
    const order = [
      container.querySelector("h1"),
      screen.getByRole("link", { name: "Find a healthcare facility" }),
      screen.getByRole("search"),
      screen.getByRole("navigation", { name: "Categories" }),
    ] as HTMLElement[];

    for (let index = 1; index < order.length; index++) {
      const followsPrevious = order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(followsPrevious, `element ${index} should come after element ${index - 1}`).toBeTruthy();
    }
  });

  it("is a server component, with no inline hex colours and no medical advice wording", () => {
    const source = readSource("app/(public)/find/page.tsx");

    expect(source).not.toMatch(/["']use client["']/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("has no sponsored or featured placement and does not build the SwiftRescue panel (it only links to /emergency)", () => {
    render(<FindPage />);

    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();
    expect(screen.queryByText("Emergency contacts")).not.toBeInTheDocument();
  });
});

// The Find blood page itself is tested in BloodPages.test.tsx (phase 8); /find only links to it (the Blood shortcut).
