// @vitest-environment jsdom
/** Tests for FiltersDialog. Requirements: US-05, FR-04, FR-05, NFR-07, NFR-10. UI spec 2.3, item 1, and decision 6.
 * A native <dialog>; jsdom needs a small stand-in for showModal() and close() (tests/helpers/dialog.ts).
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiltersDialog } from "@/components/search/FiltersDialog";
import { resetMetaCache } from "@/lib/api/meta";
import type { SearchFilters } from "@/lib/search/searchQuery";

import { AREAS, json, META, stubApi } from "../helpers/api";
import { installDialogSupport } from "../helpers/dialog";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

beforeEach(() => {
  installDialogSupport();
  resetMetaCache();
  navigation.replace.mockReset();
  navigation.push.mockReset();
  stubApi({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDialog(filters: SearchFilters = {}, hasPosition = true) {
  render(<FiltersDialog filters={filters} hasPosition={hasPosition} />);
  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  const dialog = screen.getByRole("dialog", { name: "Filters", hidden: true });
  await within(dialog).findByRole("option", { name: "Pharmacy" }); // the lists of /meta have arrived
  return dialog;
}

function optionsOf(select: HTMLElement): string[] {
  return [...select.querySelectorAll("option")].map((option) => option.textContent ?? "");
}

describe("FiltersDialog", () => {
  it("has a Filters button (48 px or more, icon and word) and a dialog that starts closed", () => {
    render(<FiltersDialog filters={{}} hasPosition={true} />);

    const button = screen.getByRole("button", { name: "Filters" });
    expect(button.className).toMatch(/min-h-12|min-h-\[50px\]/);
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute("open");
  });

  it("opens with the button and shows the choices from /meta", async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveAttribute("open");
    expect(optionsOf(within(dialog).getByRole("combobox", { name: "Category" }))).toEqual(["Any category", "Pharmacy"]);
    expect(optionsOf(within(dialog).getByRole("combobox", { name: "Area" }))).toEqual(["Any area", ...AREAS]);
  });

  it("has the service as a pick-from-list of the services of /meta, with 'Any service' first", async () => {
    const dialog = await openDialog();

    expect(optionsOf(within(dialog).getByRole("combobox", { name: "Service" }))).toEqual(["Any service", ...META.services]);
  });

  it("keeps a service from a shared link that is not in the list, as the selected choice", async () => {
    const dialog = await openDialog({ service: "Dental Scaling" });

    const select = within(dialog).getByRole("combobox", { name: "Service" });
    expect(select).toHaveValue("Dental Scaling");
    expect(optionsOf(select)).toContain("Dental Scaling");
  });

  it("shows the current filters", async () => {
    const dialog = await openDialog({ category: "pharmacy", area: "Ogui", open_now: true, is_24_hours: true, radius_km: 10 });

    expect(within(dialog).getByRole("combobox", { name: "Category" })).toHaveValue("pharmacy");
    expect(within(dialog).getByRole("combobox", { name: "Area" })).toHaveValue("Ogui");
    expect(within(dialog).getByRole("checkbox", { name: "Open now" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Open 24 hours" })).toBeChecked();
    expect(within(dialog).getByRole("combobox", { name: "Distance" })).toHaveValue("10");
  });

  it("Apply writes the filters into the address, without lat or lng, and replaces the history entry", async () => {
    const dialog = await openDialog({}, true);

    await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Category" }), "pharmacy");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Open now" }));
    await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Distance" }), "10");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(navigation.replace).toHaveBeenCalledTimes(1);
    const address = navigation.replace.mock.calls[0][0] as string;
    expect(address).toBe("/search?category=pharmacy&open_now=true&radius_km=10");
    expect(address).not.toMatch(/lat|lng/);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(dialog).not.toHaveAttribute("open");
  });

  it("Apply keeps the search text", async () => {
    const dialog = await openDialog({ q: "nigt" });

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Open 24 hours" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(navigation.replace).toHaveBeenCalledWith("/search?q=nigt&is_24_hours=true");
  });

  it("disables the distance with a hint when there is no position, and Apply leaves the distance out", async () => {
    const dialog = await openDialog({ radius_km: 10 }, false);

    const distance = within(dialog).getByRole("combobox", { name: "Distance" });
    expect(distance).toBeDisabled();
    const hint = within(dialog).getByText("Share your location to filter by distance.");
    expect(distance).toHaveAccessibleDescription("Share your location to filter by distance.");
    expect(hint).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(navigation.replace).toHaveBeenCalledWith("/search");
  });

  it("enables the distance, with no hint, when there is a position", async () => {
    const dialog = await openDialog({}, true);

    expect(within(dialog).getByRole("combobox", { name: "Distance" })).toBeEnabled();
    expect(within(dialog).queryByText("Share your location to filter by distance.")).not.toBeInTheDocument();
    expect(optionsOf(within(dialog).getByRole("combobox", { name: "Distance" }))).toEqual([
      "Any distance", "Within 5 km", "Within 10 km", "Within 20 km",
    ]);
  });

  it("Clear filters empties every filter (the search text stays) and closes the dialog", async () => {
    const dialog = await openDialog({
      q: "nigt", category: "pharmacy", service: "X-ray", area: "Ogui", open_now: true, is_24_hours: true, radius_km: 5,
    });

    await userEvent.click(within(dialog).getByRole("button", { name: "Clear filters" }));

    expect(navigation.replace).toHaveBeenCalledWith("/search?q=nigt");
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes with the Close button without changing the address", async () => {
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(dialog).not.toHaveAttribute("open");
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  // A tap outside the sheet lands on the <dialog> element itself (the backdrop is part of it). The sheet's own content is
  // inside an inner box, so a tap on the heading, a field or the padding never lands on the <dialog> itself.
  it("closes when the backdrop is tapped, without changing the address", async () => {
    const dialog = await openDialog();

    await userEvent.click(dialog);

    expect(dialog).not.toHaveAttribute("open");
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("gives focus back to the Filters button after a backdrop tap", async () => {
    const dialog = await openDialog();

    await userEvent.click(dialog);

    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("stays open when the sheet's own content is tapped", async () => {
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("heading", { name: "Filters" }));
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Category" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Open now" }));

    expect(dialog).toHaveAttribute("open");
  });

  it("stays open when a press starts inside the sheet and ends on the backdrop (selecting text, a slipped finger)", async () => {
    const dialog = await openDialog();

    fireEvent.pointerDown(within(dialog).getByRole("heading", { name: "Filters" }));
    fireEvent.click(dialog); // the browser sends the click to the nearest shared parent: the dialog

    expect(dialog).toHaveAttribute("open");
  });

  it("a press that starts on the backdrop closes it, and one stray click afterwards does not close a reopened sheet", async () => {
    const dialog = await openDialog();
    await userEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(dialog); // no press started on the backdrop

    expect(dialog).toHaveAttribute("open");
  });

  it("Esc still closes it (the browser sends cancel, then close) and focus goes back", async () => {
    const dialog = await openDialog();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    (dialog as HTMLDialogElement).close(); // what the browser does after cancel

    expect(dialog).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("gives focus back to the Filters button when it closes (Esc and Close both send the close event)", async () => {
    const dialog = await openDialog();

    fireEvent(dialog, new Event("close"));

    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("forgets what was changed but not applied when it is opened again", async () => {
    const dialog = await openDialog({ category: "pharmacy" });
    await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Category" }), "");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(within(dialog).getByRole("combobox", { name: "Category" })).toHaveValue("pharmacy");
  });

  it("shows an error with Retry when /meta cannot be loaded, then the choices", async () => {
    let attempts = 0;
    stubApi({ meta: () => (++attempts === 1 ? json({ detail: "down" }, 500) : json(META)) });
    render(<FiltersDialog filters={{}} hasPosition={true} />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", { hidden: true });

    expect(await within(dialog).findByText("We couldn't load the choices. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    expect(await within(dialog).findByRole("option", { name: "Pharmacy" })).toBeInTheDocument();
  });

  it("has tap targets of 48 px or more and 16 px text in the dialog", async () => {
    const dialog = await openDialog();

    for (const control of within(dialog).getAllByRole("combobox")) {
      expect(control.className).toMatch(/min-h-\[50px\]/);
      expect(control.className).toMatch(/\btext-base\b/);
    }
    for (const button of within(dialog).getAllByRole("button")) {
      expect(button.className, button.textContent ?? "").toMatch(/min-h-\[50px\]|min-h-12/);
    }
    for (const label of dialog.querySelectorAll("label")) {
      expect(label.className, label.textContent ?? "").toMatch(/min-h-12|text-base/);
    }
  });
});
