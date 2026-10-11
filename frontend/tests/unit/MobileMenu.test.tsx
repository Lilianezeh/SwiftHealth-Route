// @vitest-environment jsdom
/** Tests for the phone menu of the header. Requirements: FR-02, NFR-10 (48 px, keyboard, screen readers), NFR-04.
 * UI spec, "Layout": the Menu button shows the word and an icon, says whether it is open (aria-expanded), opens a panel with
 * the links, and Esc closes it. SwiftRescue is not in the panel: it stays in the bar (SiteHeader.test.tsx).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";

function renderMenu() {
  return render(<MobileMenu links={siteConfig.menuLinks} />);
}

describe("MobileMenu", () => {
  it("has a Menu button with the word and a decorative icon, at least 48 px high", () => {
    renderMenu();

    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.className).toMatch(/min-h-12(\s|$)/);
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveTextContent("Menu");
  });

  it("starts closed: aria-expanded is false and there are no links", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Menu links" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens with the button: aria-expanded is true and the panel has Find care and For facilities", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("navigation", { name: "Menu links" });
    expect(button).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/find");
    expect(within(panel).getByRole("link", { name: "For facilities" })).toHaveAttribute("href", "/list-your-facility");
  });

  it("makes every link of the panel at least 48 px high", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    for (const link of screen.getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-12(\s|$)/);
    }
  });

  it("closes with the button", async () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Menu links" })).not.toBeInTheDocument();
  });

  it("closes with Escape and puts the focus back on the button", async () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(button);
    await userEvent.tab(); // into the panel: the first link

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("navigation", { name: "Menu links" })).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes when a link is chosen, so the next page does not open under an open menu", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    await userEvent.click(screen.getByRole("link", { name: "Find care" }));

    expect(screen.queryByRole("navigation", { name: "Menu links" })).not.toBeInTheDocument();
  });

  it("does not listen for Escape while it is closed", async () => {
    renderMenu();

    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Menu" })).not.toHaveFocus();
  });
});
