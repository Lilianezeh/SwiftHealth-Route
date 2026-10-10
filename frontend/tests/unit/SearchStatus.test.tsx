// @vitest-environment jsdom
/** Tests for SearchStatus. Requirements: US-01, FR-04, NFR-10. UI spec 2.3 and "Standard states". */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchStatus } from "@/components/search/SearchStatus";

const NOTHING = () => {};

describe("SearchStatus", () => {
  it("shows skeleton cards while loading, never a blank screen, and no waking-up notice yet", () => {
    const { container } = render(<SearchStatus status="loading" total={0} hasPosition={false} onRetry={NOTHING} />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("search-status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();
  });

  it("when slow, keeps the skeleton and adds the waking-up sentence, announced politely", () => {
    const { container } = render(<SearchStatus status="slow" total={0} hasPosition={false} onRetry={NOTHING} />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("The service is waking up. This can take up to a minute.");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the error with a Retry button that calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<SearchStatus status="error" total={0} hasPosition={false} onRetry={onRetry} />);

    expect(screen.getByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows '12 places, nearest first' with a position", () => {
    render(<SearchStatus status="ready" total={12} hasPosition={true} onRetry={NOTHING} />);

    expect(screen.getByText("12 places, nearest first")).toBeInTheDocument();
  });

  it("shows '12 places, A to Z' without a position", () => {
    render(<SearchStatus status="ready" total={12} hasPosition={false} onRetry={NOTHING} />);

    expect(screen.getByText("12 places, A to Z")).toBeInTheDocument();
  });

  it("says '1 place' for one", () => {
    render(<SearchStatus status="ready" total={1} hasPosition={true} onRetry={NOTHING} />);

    expect(screen.getByText("1 place, nearest first")).toBeInTheDocument();
  });

  it("shows the empty state with what to try next", () => {
    render(<SearchStatus status="ready" total={0} hasPosition={true} onRetry={NOTHING} />);

    expect(screen.getByText("No matches. Try removing a filter or widening the distance.")).toBeInTheDocument();
    expect(screen.queryByText(/nearest first/)).not.toBeInTheDocument();
  });

  it("has a Retry button at least 50 px high", () => {
    render(<SearchStatus status="error" total={0} hasPosition={false} onRetry={NOTHING} />);

    expect(screen.getByRole("button", { name: "Retry" }).className).toMatch(/min-h-\[50px\]/);
  });
});
