// @vitest-environment jsdom
/** The contact buttons of the listing page: Call (primary), WhatsApp (only for a number marked as WhatsApp), Directions, and the other phones.
 * Requirements: US-02, US-03, FR-10, FR-47, NFR-07, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D1, D2 and D9.
 * The tests quote WhatsApp's click-to-chat page (https://whatsapp.com/faq/en/general/26000030) in tests/unit/whatsapp.test.ts.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContactButtons } from "@/components/listing/ContactButtons";
import { OtherPhones } from "@/components/listing/OtherPhones";
import { WhatsAppButton } from "@/components/listing/WhatsAppButton";
import { CallButton } from "@/components/listings/CallButton";

import { makeListing, OTHER_PHONE, PRIMARY_PHONE } from "../helpers/listing";

const WHATSAPP_LINK = "https://wa.me/2348030000000?text=Hello%2C%20I%20found%20you%20on%20SwiftHealth%20Route.";

describe("CallButton on the listing page", () => {
  it("names the number's label when it has one, and can be the large (56 px) button", () => {
    render(<CallButton phone="+2340000000013" facilityName="Night Pharmacy A" label="Emergency" />);
    expect(screen.getByRole("link")).toHaveAccessibleName("Call Night Pharmacy A (Emergency)");
    expect(screen.getByRole("link")).toHaveAttribute("href", "tel:+2340000000013");
  });

  it("is 56 px high when large, and 50 px otherwise", () => {
    const { rerender } = render(<CallButton phone="+2340000000012" facilityName="X" large />);
    expect(screen.getByRole("link").className).toMatch(/\bmin-h-14\b/);

    rerender(<CallButton phone="+2340000000012" facilityName="X" />);
    expect(screen.getByRole("link").className).toMatch(/min-h-\[50px\]/);
  });
});

describe("WhatsAppButton (the owner's Option A)", () => {
  it("links to wa.me with the number in international form and the fixed message, in a new tab", () => {
    render(<WhatsAppButton phone="+2348030000000" facilityName="Night Pharmacy A" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", WHATSAPP_LINK);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("makes the same link from the local form 0803..., and shows nothing for a number that cannot be a Nigerian number", () => {
    const { container, rerender } = render(<WhatsAppButton phone="08030000000" facilityName="X" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", WHATSAPP_LINK);

    rerender(<WhatsAppButton phone="+14155550123" facilityName="X" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reads 'WhatsApp' and names the place and the new tab for screen readers (the visible word is in the name)", () => {
    render(<WhatsAppButton phone="+2348030000000" facilityName="Night Pharmacy A" />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(/^WhatsApp$/);
    expect(link).toHaveAccessibleName("WhatsApp Night Pharmacy A (opens in a new tab)");
  });

  it("names the number's label too, when the facility has several WhatsApp numbers", () => {
    render(<WhatsAppButton phone="+2348030000000" facilityName="Night Pharmacy A" label="Front desk" />);

    expect(screen.getByRole("link")).toHaveAccessibleName("WhatsApp Night Pharmacy A (Front desk) (opens in a new tab)");
  });

  it("has the owner's glyph unchanged except for its size: a 24 px image with no alt text, never an SVG of ours", () => {
    const { container } = render(<WhatsAppButton phone="+2348030000000" facilityName="X" />);

    const glyph = container.querySelector("img");
    expect(glyph).toHaveAttribute("src", "/images/brand/whatsapp-glyph-72.png");
    expect(glyph).toHaveAttribute("alt", "");
    expect(glyph).toHaveAttribute("width", "24");
    expect(glyph).toHaveAttribute("height", "24");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("is the white button with the dark green border and the ink label (Option A), at least 50 px high, with 16 px text", () => {
    render(<WhatsAppButton phone="+2348030000000" facilityName="X" />);

    const className = screen.getByRole("link").className;
    expect(className).toMatch(/\bborder-whatsapp-dark\b/);
    expect(className).toMatch(/\btext-ink\b/);
    expect(className).toMatch(/\bbg-white\b/);
    expect(className).toMatch(/min-h-\[50px\]/);
    expect(className).toMatch(/\btext-base\b/);
    expect(className).not.toMatch(/\btext-white\b/); // never white text on green
  });
});

describe("ContactButtons", () => {
  it("has the big Call button for the primary phone first, and Directions", () => {
    render(<ContactButtons listing={makeListing()} />);

    const call = screen.getByRole("link", { name: "Call Night Pharmacy A" });
    expect(call).toHaveAttribute("href", `tel:${PRIMARY_PHONE.number}`);
    expect(call.className).toMatch(/\bmin-h-14\b/); // 56 px: Call is the biggest button
    expect(call.className).toMatch(/\bbg-pine\b/); // and the primary one
    expect(screen.getByRole("link", { name: /^Directions to Night Pharmacy A/ })).toBeInTheDocument();
  });

  it("shows no WhatsApp button when no number is marked as WhatsApp", () => {
    render(<ContactButtons listing={makeListing()} />);

    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it("shows WhatsApp beside Call when the primary number is marked, in this order: Call, WhatsApp, Directions", () => {
    const listing = makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }, OTHER_PHONE] });
    render(<ContactButtons listing={listing} />);

    const names = screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(names).toEqual([
      "Call Night Pharmacy A",
      "WhatsApp Night Pharmacy A (opens in a new tab)",
      "Directions to Night Pharmacy A (opens in a new tab)",
    ]);
    expect(screen.getByRole("link", { name: /^WhatsApp/ })).toHaveAttribute("href", WHATSAPP_LINK);
  });

  it("does not show WhatsApp for the primary number when only the other number is marked (the flag is per number)", () => {
    const listing = makeListing({ phones: [PRIMARY_PHONE, { ...OTHER_PHONE, is_whatsapp: true }] });
    render(<ContactButtons listing={listing} />);

    expect(screen.queryByRole("link", { name: /^WhatsApp/ })).not.toBeInTheDocument();
  });

  it("shows only Directions when the listing has no phone number", () => {
    render(<ContactButtons listing={makeListing({ phones: [], primary_phone: null })} />);

    expect(screen.queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Directions/ })).toBeInTheDocument();
  });

  it("wraps its buttons instead of squeezing them, so nothing overflows at 320 px", () => {
    const listing = makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }] });
    const { container } = render(<ContactButtons listing={listing} />);

    expect(container.querySelector(".flex-wrap")).not.toBeNull();
    for (const cell of container.querySelectorAll(".flex-wrap > div")) expect(cell.className).toMatch(/min-w-\[8\.5rem\]/);
  });

  it("builds the Directions link from the facility's position and no WhatsApp or Call link holds a position", () => {
    const listing = makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }] });
    render(<ContactButtons listing={listing} />);

    expect(screen.getByRole("link", { name: /^Directions/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=6.452,7.51",
    );
    for (const name of [/^Call/, /^WhatsApp/]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).not.toMatch(/6\.452|7\.51|lat|lng/);
    }
  });
});

describe("OtherPhones", () => {
  it("lists each other number with its label, its number and its own Call button", () => {
    render(<OtherPhones phones={[OTHER_PHONE]} facilityName="Night Pharmacy A" />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Emergency")).toBeInTheDocument();
    expect(within(item).getByText("+2340000000013")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Call Night Pharmacy A (Emergency)" })).toHaveAttribute(
      "href",
      "tel:+2340000000013",
    );
    expect(within(item).queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it("adds a WhatsApp button for an other number that is marked, and none for the ones that are not", () => {
    const marked = { ...OTHER_PHONE, number: "+2348030000001", label: "Reception", is_whatsapp: true };
    render(<OtherPhones phones={[OTHER_PHONE, marked]} facilityName="Night Pharmacy A" />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(within(items[1]).getByRole("link", { name: /WhatsApp Night Pharmacy A \(Reception\)/ })).toBeInTheDocument();
  });

  it("shows nothing at all when there is no other number", () => {
    const { container } = render(<OtherPhones phones={[]} facilityName="X" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives a number without a label a plain name", () => {
    render(<OtherPhones phones={[{ ...OTHER_PHONE, label: null }]} facilityName="X" />);

    expect(screen.getByText("Other number")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call X" })).toBeInTheDocument();
  });
});
