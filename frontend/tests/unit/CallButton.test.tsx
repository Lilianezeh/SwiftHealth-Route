// @vitest-environment jsdom
/** Tests for CallButton. Requirements: FR-06, FR-10, NFR-10 (a tel: link, 48 px or more, named for screen readers). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CallButton } from "@/components/listings/CallButton";

describe("CallButton", () => {
  it("is a tel: link with the +234 number", () => {
    render(<CallButton phone="+2348030000001" facilityName="Night Pharmacy A" />);
    expect(screen.getByRole("link", { name: /Call Night Pharmacy A/ })).toHaveAttribute("href", "tel:+2348030000001");
  });

  it("reads 'Call' on the screen and names the facility for screen readers", () => {
    render(<CallButton phone="+2348030000001" facilityName="Night Pharmacy A" />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Call");
    expect(link).toHaveAccessibleName("Call Night Pharmacy A");
  });

  it("is at least 50 px high, with 16 px text, and is a primary button made of tokens", () => {
    render(<CallButton phone="+2348030000001" facilityName="Night Pharmacy A" />);
    const className = screen.getByRole("link").className;
    expect(className).toMatch(/min-h-\[50px\]/);
    expect(className).toMatch(/\btext-base\b/);
    expect(className).toMatch(/\bbg-pine\b/);
    expect(className).toMatch(/\btext-white\b/);
  });

  it.each(["", "0803 000 0001", "08030000001", "+2340", "+23480300000012", "tel:+2348030000001", "javascript:alert(1)", "+234 803 000 0001"])(
    "shows nothing for '%s', which is not a +234 number with ten digits",
    (phone) => {
      const { container } = render(<CallButton phone={phone} facilityName="Night Pharmacy A" />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("never puts the number into the page as anything but the link address", () => {
    render(<CallButton phone="+2348030000001" facilityName="Night Pharmacy A" />);
    expect(screen.queryByText(/\+2348030000001/)).not.toBeInTheDocument();
  });
});
