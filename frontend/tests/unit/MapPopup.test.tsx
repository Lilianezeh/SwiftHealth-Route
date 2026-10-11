// @vitest-environment jsdom
/** Tests for the content of a pin's popup. Requirements: FR-07, US-01, US-03, NFR-10. UI spec, the `MapPopup` row.
 * Call and Directions are the same components as on the cards. All text is rendered as text, never as HTML.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapPopup } from "@/components/search/MapPopup";

import { listing } from "../helpers/api";

describe("MapPopup", () => {
  it("shows the name as a link to the listing, and the category with the distance", () => {
    render(<MapPopup listing={listing()} />);

    expect(screen.getByRole("link", { name: "Night Pharmacy A" })).toHaveAttribute("href", "/listing/night-pharmacy-a");
    expect(screen.getByText("Pharmacy · 1.4 km")).toBeInTheDocument();
  });

  it("shows only the category when there is no distance", () => {
    render(<MapPopup listing={listing({ distance_km: null })} />);

    expect(screen.getByText("Pharmacy")).toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("shows the open badge in words", () => {
    render(<MapPopup listing={listing({ is_open_now: false })} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("has a Call button with the number and a Directions button with the place", () => {
    render(<MapPopup listing={listing()} />);

    expect(screen.getByRole("link", { name: "Call Night Pharmacy A" })).toHaveAttribute("href", "tel:+2340000000012");
    const directions = screen.getByRole("link", { name: /Directions to Night Pharmacy A/ });
    expect(directions).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=6.452,7.51");
    expect(directions).toHaveAttribute("target", "_blank");
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has no Call button without a phone number, but still has Directions", () => {
    render(<MapPopup listing={listing({ primary_phone: null })} />);

    expect(screen.queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Directions to/ })).toBeInTheDocument();
  });

  it("shows the Sponsored tag only for a sponsored result", () => {
    const { rerender } = render(<MapPopup listing={listing({ sponsored: false })} />);
    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();

    rerender(<MapPopup listing={listing({ sponsored: true })} />);
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
  });

  it("shows a name with HTML in it as text, never as markup", () => {
    const { container } = render(<MapPopup listing={listing({ name: '<img src=x onerror="alert(1)"> & Sons' })} />);

    expect(screen.getByRole("link", { name: '<img src=x onerror="alert(1)"> & Sons' })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("has the class that keeps Leaflet's link colour off its buttons", () => {
    const { container } = render(<MapPopup listing={listing()} />);

    expect(container.firstElementChild).toHaveClass("map-popup");
  });
});
