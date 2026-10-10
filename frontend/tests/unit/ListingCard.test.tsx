// @vitest-environment jsdom
/** Tests for ListingCard. Requirements: US-01, FR-06, FR-08, NFR-10. UI spec: components table, ListingCard. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListingCard } from "@/components/listings/ListingCard";
import type { ListingSummary } from "@/types/api";

const NOW = new Date("2026-10-09T12:00:00Z");

const NIGHT_PHARMACY: ListingSummary = {
  id: 12,
  slug: "night-pharmacy-a",
  name: "Night Pharmacy A",
  category: { slug: "pharmacy", name: "Pharmacy" },
  area: "New Haven",
  address: "12 Example Road",
  latitude: 6.452,
  longitude: 7.51,
  distance_km: 1.4,
  is_open_now: true,
  is_24_hours: false,
  primary_phone: "+2340000000012",
  last_verified_at: "2026-10-06T09:00:00Z",
  verification_due: false,
  sponsored: false,
};

function renderCard(changes: Partial<ListingSummary> = {}) {
  return render(<ListingCard listing={{ ...NIGHT_PHARMACY, ...changes }} now={NOW} />);
}

describe("ListingCard", () => {
  it("shows the name, the category with the distance, the address and the area", () => {
    renderCard();

    expect(screen.getByRole("heading", { level: 3, name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(screen.getByText("Pharmacy · 1.4 km")).toBeInTheDocument();
    expect(screen.getByText("12 Example Road")).toBeInTheDocument();
    expect(screen.getByText("New Haven")).toBeInTheDocument();
  });

  it("shows the open label and the verified label", () => {
    renderCard();

    expect(screen.getByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("Verified 3 days ago")).toBeInTheDocument();
  });

  it("links the name to the listing page", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Night Pharmacy A" })).toHaveAttribute("href", "/listing/night-pharmacy-a");
  });

  it("has a Call button and a Directions button", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /^Call Night Pharmacy A/ })).toHaveAttribute("href", "tel:+2340000000012");
    expect(screen.getByRole("link", { name: /^Directions to Night Pharmacy A/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=6.452,7.51",
    );
  });

  it("hides the distance when there is none", () => {
    renderCard({ distance_km: null });

    expect(screen.getByText("Pharmacy")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("shows a Sponsored tag only when the listing is sponsored", () => {
    const { unmount } = renderCard({ sponsored: false });
    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();
    unmount();

    renderCard({ sponsored: true });
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
  });

  it("shows no Call button when the listing has no phone number, and keeps Directions", () => {
    renderCard({ primary_phone: null });

    expect(screen.queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Directions/ })).toBeInTheDocument();
  });

  it("shows 'Verification due' with the date for an overdue listing, and keeps the Call button", () => {
    renderCard({ verification_due: true, last_verified_at: "2026-08-25T12:00:00Z" });

    expect(screen.getByText("Verification due")).toBeInTheDocument();
    expect(screen.getByText("Verified 45 days ago")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Call/ })).toBeInTheDocument();
  });

  it("shows 'Closed' for a closed place and 'Open 24 hours' for a 24-hour place", () => {
    const { unmount } = renderCard({ is_open_now: false });
    expect(screen.getByText("Closed")).toBeInTheDocument();
    unmount();

    renderCard({ is_open_now: false, is_24_hours: true });
    expect(screen.getByText("Open 24 hours")).toBeInTheDocument();
  });

  it("renders HTML in a name as text, never as markup", () => {
    const { container } = renderCard({ name: '<img src=x onerror="alert(1)"> Clinic', address: "<b>1 Road</b>" });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent('<img src=x onerror="alert(1)"> Clinic');
    expect(screen.getByText("<b>1 Road</b>")).toBeInTheDocument();
  });

  it("is one article that a screen reader can find by its name", () => {
    renderCard();

    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("has no text under 16 px and no hand-written colour", () => {
    const { container } = renderCard({ sponsored: true, verification_due: true });

    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba?\(/);
    expect(container.innerHTML).not.toMatch(/style=/);
  });

  it("gives every link a tap target of at least 48 px", () => {
    renderCard();

    for (const link of screen.getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-(\[50px\]|12)(\s|$)/);
    }
  });

  it("uses a white card with a line border and the card shadow, made of tokens", () => {
    renderCard();

    const className = screen.getByRole("article").className;
    expect(className).toMatch(/\bbg-white\b/);
    expect(className).toMatch(/\bborder-line\b/);
    expect(className).toMatch(/\bshadow-card\b/);
  });
});
