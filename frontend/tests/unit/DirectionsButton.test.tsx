// @vitest-environment jsdom
/** Tests for DirectionsButton. Requirements: FR-06, FR-10 (Google Maps link from the GPS pin), NFR-10. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DirectionsButton } from "@/components/listings/DirectionsButton";

describe("DirectionsButton", () => {
  it("opens the Google Maps directions link for the listing's latitude and longitude", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=6.452,7.51",
    );
  });

  it("opens in a new tab without giving the new page a handle on ours", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("reads 'Directions' and tells screen readers the place and that it opens a new tab", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Directions");
    expect(link).toHaveAccessibleName("Directions to Night Pharmacy A (opens in a new tab)");
  });

  it("is a secondary button, at least 50 px high, with 16 px text, made of tokens", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="Night Pharmacy A" />);
    const className = screen.getByRole("link").className;
    expect(className).toMatch(/min-h-\[50px\]/);
    expect(className).toMatch(/\btext-base\b/);
    expect(className).toMatch(/\bborder-pine\b/);
    expect(className).toMatch(/\btext-forest\b/);
    expect(className).not.toMatch(/\bbg-pine\b/);
  });

  it("does not put the facility name into the address", () => {
    render(<DirectionsButton latitude={6.452} longitude={7.51} facilityName="A&B <script>" />);
    expect(screen.getByRole("link").getAttribute("href")).not.toMatch(/script|A&B/);
  });

  it.each([[NaN, 7.5], [6.4, Infinity], [91, 7.5], [6.4, 181]])(
    "shows nothing for a position that cannot be real (%s, %s)",
    (latitude, longitude) => {
      const { container } = render(<DirectionsButton latitude={latitude} longitude={longitude} facilityName="X" />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
