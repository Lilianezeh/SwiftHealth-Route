// @vitest-environment jsdom
/** The "Sponsored" label of the results. Requirements: FR-45, FR-19, NFR-10. Decision I11 in
 * specs/2026-10-20-providers-payments/requirements.md. The API decides which result is sponsored (at most one, first); the list
 * only shows the label, in words, on the item the API marks, and keeps the order it was given.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultsList } from "@/components/search/ResultsList";

import { manyListings } from "../helpers/api";

describe("the Sponsored label in the results list", () => {
  it("is on the one sponsored item, which stays first, and on no other", () => {
    const [first, second, third] = manyListings(3);
    render(<ResultsList items={[{ ...first, sponsored: true }, second, third]} />);

    const cards = screen.getAllByRole("article");

    expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual(["Place 1", "Place 2", "Place 3"]);
    expect(within(cards[0]).getByText("Sponsored")).toBeInTheDocument();
    expect(within(cards[1]).queryByText("Sponsored")).toBeNull();
    expect(within(cards[2]).queryByText("Sponsored")).toBeNull();
    expect(screen.getAllByText("Sponsored")).toHaveLength(1);
  });

  it("is in words, with a background and text colour from the tokens, and no label at all when nothing is sponsored", () => {
    const [first, second] = manyListings(2);
    const { rerender } = render(<ResultsList items={[{ ...first, sponsored: true }, second]} />);
    const tag = screen.getByText("Sponsored");
    expect(tag.className).toMatch(/bg-amber/);
    expect(tag.className).toMatch(/text-ink/);

    rerender(<ResultsList items={[first, second]} />);

    expect(screen.queryByText("Sponsored")).toBeNull();
  });
});
