// @vitest-environment jsdom
/** Tests for HoursNote. Requirements: FR-06, US-01, NFR-10. UI spec: components table, ListingCard (the hours line).
 * Decisions 1 to 4 in specs/2026-10-10-hours-note-on-card/requirements.md.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HoursNote } from "@/components/listings/HoursNote";

describe("HoursNote", () => {
  it("shows the text of the API with a Clock icon beside it", () => {
    const { container } = render(<HoursNote note="Closes 9:00 PM" />);

    const text = screen.getByText("Closes 9:00 PM");
    const icon = container.querySelector("svg") as SVGElement;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("class")).toMatch(/lucide-clock\b/);
    expect(text.parentElement).toContainElement(icon); // the icon and the text share one line
  });

  it("hides the icon from screen readers, so only the text is read", () => {
    const { container } = render(<HoursNote note="Opens 7:30 AM tomorrow" />);

    const icon = container.querySelector("svg") as SVGElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
    expect(container).toHaveTextContent("Opens 7:30 AM tomorrow");
  });

  it.each([null, "", "   "])("shows nothing at all for %j: no text, no icon, no empty row", (note) => {
    const { container } = render(<HoursNote note={note} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the text as text, never as HTML", () => {
    const { container } = render(<HoursNote note="<img src=x onerror=alert(1)> Closes 9:00 PM" />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> Closes 9:00 PM")).toBeInTheDocument();
  });

  it("uses 16 px text and token colours, with no hand-written colour", () => {
    render(<HoursNote note="Opens Monday 7:30 AM" />);

    const className = screen.getByText("Opens Monday 7:30 AM").parentElement?.className ?? "";
    expect(className).toMatch(/\btext-base\b/);
    expect(className).toMatch(/\btext-ink-soft\b/);
    expect(className).not.toMatch(/\btext-(xs|sm)\b|#[0-9a-f]{3,6}|\[#/i);
  });

  it("lets a long text wrap instead of scrolling sideways", () => {
    render(<HoursNote note="Opens Wednesday at midnight" />);

    const className = screen.getByText("Opens Wednesday at midnight").parentElement?.className ?? "";
    expect(className).not.toMatch(/\bwhitespace-nowrap\b|\boverflow-x-/);
  });
});
