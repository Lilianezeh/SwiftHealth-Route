// @vitest-environment jsdom
/** Icons in the listing components. Owner's decision, 2026-10-09: decorative, and always beside a text label.
 * Requirements: FR-06, NFR-10. The names that screen readers hear do not change when an icon is added.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CallButton } from "@/components/listings/CallButton";
import { DirectionsButton } from "@/components/listings/DirectionsButton";
import { ListingCard } from "@/components/listings/ListingCard";
import { VerifiedDate } from "@/components/listings/VerifiedDate";
import type { ListingSummary } from "@/types/api";

const NOW = new Date("2026-10-09T12:00:00Z");

const LISTING: ListingSummary = {
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

function svgsIn(element: HTMLElement): SVGElement[] {
  return [...element.querySelectorAll("svg")] as SVGElement[];
}

describe("icons in the listing components", () => {
  it("CallButton has a phone icon beside the word Call, and keeps its accessible name", () => {
    render(<CallButton phone="+2348030000001" facilityName="Night Pharmacy A" />);
    const link = screen.getByRole("link");

    expect(svgsIn(link)).toHaveLength(1);
    expect(link).toHaveTextContent("Call");
    expect(link).toHaveAccessibleName("Call Night Pharmacy A");
  });

  it("DirectionsButton has an icon beside the word Directions, and keeps its accessible name", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);
    const link = screen.getByRole("link");

    expect(svgsIn(link)).toHaveLength(1);
    expect(link).toHaveTextContent("Directions");
    expect(link).toHaveAccessibleName("Directions to Night Pharmacy A (opens in a new tab)");
  });

  it("VerifiedDate has a shield beside 'Verified 3 days ago', and a clock beside 'Verification due'", () => {
    const { container, rerender } = render(
      <VerifiedDate lastVerifiedAt="2026-10-06T09:00:00Z" verificationDue={false} now={NOW} />,
    );
    expect(svgsIn(container)).toHaveLength(1);
    expect(container).toHaveTextContent("Verified 3 days ago");

    rerender(<VerifiedDate lastVerifiedAt="2026-08-25T12:00:00Z" verificationDue={true} now={NOW} />);
    expect(svgsIn(container)).toHaveLength(1);
    expect(container).toHaveTextContent("Verification due");
  });

  it("ListingCard has a pin beside the address", () => {
    render(<ListingCard listing={LISTING} now={NOW} />);
    const address = screen.getByText("12 Example Road");

    const addressRow = address.parentElement?.parentElement as HTMLElement; // the row: pin, then the address block
    expect(svgsIn(addressRow)).toHaveLength(1);
    expect(addressRow).toHaveTextContent("12 Example Road");
  });

  it("the hours line has a clock beside the text of the API, and its icon is decorative", () => {
    render(<ListingCard listing={LISTING} now={NOW} />);

    const hours = screen.getByText("Closes 9:00 PM").parentElement as HTMLElement;
    expect(svgsIn(hours)).toHaveLength(1);
    expect(svgsIn(hours)[0].getAttribute("aria-hidden")).toBe("true");
    expect(hours).toHaveTextContent("Closes 9:00 PM");
  });

  it("every icon in a card is hidden from screen readers and sits next to text", () => {
    const { container } = render(<ListingCard listing={{ ...LISTING, verification_due: true }} now={NOW} />);
    const icons = svgsIn(container);

    expect(icons.length).toBeGreaterThanOrEqual(4); // pin, shield or clock, phone, route
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      const parentText = (icon.parentElement?.textContent ?? "").trim();
      expect(parentText.length, "an icon has no text label next to it").toBeGreaterThan(0);
    }
  });

  it("an icon is never the only content of a link", () => {
    render(<ListingCard listing={LISTING} now={NOW} />);

    for (const link of within(screen.getByRole("article")).getAllByRole("link")) {
      expect((link.textContent ?? "").trim().length, link.outerHTML).toBeGreaterThan(0);
    }
  });
});
