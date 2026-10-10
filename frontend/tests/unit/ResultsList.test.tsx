// @vitest-environment jsdom
/** Tests for ResultsList. Requirements: US-01, FR-06, FR-08, NFR-10. UI spec 2.3, item 4. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultsList } from "@/components/search/ResultsList";

import { listing, manyListings } from "../helpers/api";

describe("ResultsList", () => {
  it("shows one card per listing, in the order the API gave", () => {
    render(<ResultsList items={manyListings(3)} />);

    const list = screen.getByRole("list", { name: "Search results" });
    expect(within(list).getAllByRole("article")).toHaveLength(3);
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Place 1", "Place 2", "Place 3",
    ]);
  });

  it("keeps a sponsored card where the API put it (first) and tags it", () => {
    render(<ResultsList items={[listing({ id: 9, name: "Paid Clinic", sponsored: true }), ...manyListings(2)]} />);

    const articles = screen.getAllByRole("article");
    expect(within(articles[0]).getByText("Paid Clinic")).toBeInTheDocument();
    expect(within(articles[0]).getByText("Sponsored")).toBeInTheDocument();
    expect(within(articles[1]).queryByText("Sponsored")).not.toBeInTheDocument();
  });

  it("shows the amber 'Verification due' label for an overdue listing, with its date (FR-08)", () => {
    render(<ResultsList items={[listing({ verification_due: true, last_verified_at: "2026-08-01T09:00:00Z" })]} />);

    expect(screen.getByText("Verification due")).toBeInTheDocument();
    expect(screen.getByText(/^Verified \d+ days ago$/)).toBeInTheDocument();
  });

  it("renders a name as text, never as HTML", () => {
    const { container } = render(<ResultsList items={[listing({ name: "<img src=x onerror=alert(1)> Pharmacy" })]} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "<img src=x onerror=alert(1)> Pharmacy" })).toBeInTheDocument();
  });

  it("shows no list at all when there is nothing", () => {
    render(<ResultsList items={[]} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
