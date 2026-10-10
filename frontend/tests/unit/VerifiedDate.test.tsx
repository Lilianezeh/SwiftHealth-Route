// @vitest-environment jsdom
/** Tests for VerifiedDate. Requirements: FR-08, US-07, NFR-08 (the last-verified date is always shown). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifiedDate } from "@/components/listings/VerifiedDate";

const NOW = new Date("2026-10-09T12:00:00Z");

describe("VerifiedDate", () => {
  it("shows 'Verified 3 days ago' in the verified colours", () => {
    const { container } = render(
      <VerifiedDate lastVerifiedAt="2026-10-06T09:00:00Z" verificationDue={false} now={NOW} />,
    );
    expect(screen.getByText("Verified 3 days ago")).toBeInTheDocument();
    expect(screen.queryByText("Verification due")).not.toBeInTheDocument();
    expect(container.firstElementChild?.className).toMatch(/\bbg-pine-100\b/);
  });

  it("shows the amber 'Verification due' label when it is due, and the date next to it", () => {
    const { container } = render(
      <VerifiedDate lastVerifiedAt="2026-08-25T12:00:00Z" verificationDue={true} now={NOW} />,
    );
    expect(screen.getByText("Verification due")).toBeInTheDocument();
    expect(screen.getByText("Verified 45 days ago")).toBeInTheDocument(); // FR-08: the date is not hidden
    expect(container.innerHTML).toMatch(/\bbg-amber-wash\b/);
    expect(container.innerHTML).toMatch(/\btext-amber-ink\b/);
  });

  it("does not show 'Verified' as a label when it is due", () => {
    const { container } = render(
      <VerifiedDate lastVerifiedAt="2026-08-25T12:00:00Z" verificationDue={true} now={NOW} />,
    );
    expect(container.innerHTML).not.toMatch(/\bbg-pine-100\b/);
  });

  it("says 'Not yet verified' when there is no date", () => {
    render(<VerifiedDate lastVerifiedAt={null} verificationDue={false} now={NOW} />);
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
  });

  it("uses the current time when none is given", () => {
    const aMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    render(<VerifiedDate lastVerifiedAt={aMinuteAgo} verificationDue={false} />);
    expect(screen.getByText("Verified today")).toBeInTheDocument();
  });

  it("uses text of 16 px (text-base) and no smaller class", () => {
    const { container } = render(
      <VerifiedDate lastVerifiedAt="2026-08-25T12:00:00Z" verificationDue={true} now={NOW} />,
    );
    expect(container.innerHTML).toMatch(/\btext-base\b/);
    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
  });
});
