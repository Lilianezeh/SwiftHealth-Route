// @vitest-environment jsdom
/** Tests for OpenNowBadge. Requirements: US-01, FR-06, NFR-10 (status in words, not only colour). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpenNowBadge } from "@/components/listings/OpenNowBadge";

describe("OpenNowBadge", () => {
  it("says 'Open now' for a place that is open", () => {
    render(<OpenNowBadge isOpenNow={true} is24Hours={false} />);
    expect(screen.getByText("Open now")).toBeInTheDocument();
  });

  it("says 'Closed' for a place that is closed", () => {
    render(<OpenNowBadge isOpenNow={false} is24Hours={false} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("says 'Open 24 hours' for a 24-hour place, and that wins over Closed", () => {
    render(<OpenNowBadge isOpenNow={false} is24Hours={true} />);
    expect(screen.getByText("Open 24 hours")).toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
  });

  it("uses the open colours for open and the closed colours for closed (tokens, not hex)", () => {
    const { container, rerender } = render(<OpenNowBadge isOpenNow={true} is24Hours={false} />);
    expect(container.firstElementChild?.className).toMatch(/\bbg-open-bg\b/);
    expect(container.firstElementChild?.className).toMatch(/\btext-open\b/);

    rerender(<OpenNowBadge isOpenNow={false} is24Hours={false} />);
    expect(container.firstElementChild?.className).toMatch(/\bbg-closed-bg\b/);
    expect(container.firstElementChild?.className).toMatch(/\btext-closed\b/);
  });

  it("hides the decorative dot from screen readers", () => {
    const { container } = render(<OpenNowBadge isOpenNow={true} is24Hours={false} />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("uses text of 16 px (text-base)", () => {
    const { container } = render(<OpenNowBadge isOpenNow={true} is24Hours={false} />);
    expect(container.firstElementChild?.className).toMatch(/\btext-base\b/);
  });
});
