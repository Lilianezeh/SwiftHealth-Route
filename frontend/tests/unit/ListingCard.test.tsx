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
  hours_note: "Closes 9:00 PM",
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

  it("shows 'Branch of {name}' with a link to the main facility when the API sends branch_of (FR-52)", () => {
    renderCard({ branch_of: { name: "Night Pharmacy Main", slug: "night-pharmacy-main" } });

    expect(screen.getByText(/^Branch of/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Night Pharmacy Main" })).toHaveAttribute("href", "/listing/night-pharmacy-main");
  });

  it("shows no 'Branch of' line for a main facility", () => {
    renderCard();
    expect(screen.queryByText(/^Branch of/)).toBeNull();
    renderCard({ branch_of: null });
    expect(screen.queryByText(/^Branch of/)).toBeNull();
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

  it("uses a card (surface) with a line border and the card shadow, made of tokens", () => {
    renderCard();

    const className = screen.getByRole("article").className;
    expect(className).toMatch(/\bbg-surface\b/);
    expect(className).toMatch(/\bborder-line\b/);
    expect(className).toMatch(/\bshadow-card\b/);
  });
});

describe("ListingCard hours line (hours_note)", () => {
  it("shows the hours line under the address, before the Call and Directions buttons", () => {
    renderCard({ hours_note: "Closes 9:00 PM" });

    const address = screen.getByText("New Haven"); // the last line of the address block
    const hours = screen.getByText("Closes 9:00 PM");
    const call = screen.getByRole("link", { name: /^Call/ });
    expect(address.compareDocumentPosition(hours) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hours.compareDocumentPosition(call) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the text the API gives, word for word", () => {
    renderCard({ hours_note: "Opens Monday 7:30 AM", is_open_now: false });

    expect(screen.getByText("Opens Monday 7:30 AM")).toBeInTheDocument();
  });

  it("shows no hours line and no extra icon when hours_note is null (a 24-hour listing)", () => {
    const withNote = renderCard({ hours_note: "Closes 9:00 PM" });
    const iconsWithNote = withNote.container.querySelectorAll("svg").length;
    withNote.unmount();

    const withoutNote = renderCard({ hours_note: null, is_24_hours: true });

    expect(withoutNote.container.querySelectorAll("svg")).toHaveLength(iconsWithNote - 1);
    expect(screen.queryByText(/^(Closes|Opens) /)).not.toBeInTheDocument();
  });

  it("still shows Verification due, the date and the Call button next to the hours line", () => {
    renderCard({ verification_due: true, last_verified_at: "2026-08-25T12:00:00Z", hours_note: "Closes 9:00 PM" });

    expect(screen.getByText("Verification due")).toBeInTheDocument();
    expect(screen.getByText("Verified 45 days ago")).toBeInTheDocument();
    expect(screen.getByText("Closes 9:00 PM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Call/ })).toBeInTheDocument();
  });

  it("has two different clocks that mean different things: the amber label and the grey hours line", () => {
    renderCard({ verification_due: true, last_verified_at: "2026-08-25T12:00:00Z", hours_note: "Closes 9:00 PM" });

    const due = screen.getByText("Verification due");
    const hours = screen.getByText("Closes 9:00 PM");
    expect(due.className).toMatch(/\btext-amber-ink\b/);
    expect(hours.parentElement?.className).toMatch(/\btext-ink-soft\b/);
    expect(hours.parentElement?.className).not.toMatch(/amber/);
  });
});
