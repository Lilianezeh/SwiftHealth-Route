// @vitest-environment jsdom
/** Tests for the List | Map toggle. Requirements: FR-07, NFR-10. UI spec, the `ViewToggle` row and 2.3, item 2. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ViewToggle } from "@/components/search/ViewToggle";

describe("ViewToggle", () => {
  it("has a List and a Map button in one named group", () => {
    render(<ViewToggle view="list" onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Results view" });
    expect(group).toContainElement(screen.getByRole("button", { name: "List" }));
    expect(group).toContainElement(screen.getByRole("button", { name: "Map" }));
  });

  it("marks the current view with aria-pressed, for the list and for the map", () => {
    const { rerender } = render(<ViewToggle view="list" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "false");

    rerender(<ViewToggle view="map" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");
  });

  it("makes each button at least 48 px high, with text of 16 px or more", () => {
    render(<ViewToggle view="list" onChange={vi.fn()} />);

    for (const name of ["List", "Map"]) {
      const classes = screen.getByRole("button", { name }).className;
      expect(classes).toMatch(/min-h-12|min-h-\[50px\]/);
      expect(classes).toContain("text-base");
    }
  });

  it("tells the page which view was chosen when the other button is tapped", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ViewToggle view="list" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(onChange).toHaveBeenLastCalledWith("map");

    rerender(<ViewToggle view="map" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenLastCalledWith("list");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the view that is already shown is tapped", async () => {
    const onChange = vi.fn();
    render(<ViewToggle view="map" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Map" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
