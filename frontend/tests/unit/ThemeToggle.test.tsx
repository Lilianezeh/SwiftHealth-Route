// @vitest-environment jsdom
/** The Theme button of the header and the Menu: Light, Dark, System. Requirements: NFR-10, NFR-04, FR-02. Spec: ui-spec "Dark mode". */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { THEME_KEY } from "@/lib/theme/theme";

function fakeSystem(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: dark, addEventListener: () => undefined, removeEventListener: () => undefined })),
  );
}

const theme = () => document.documentElement.getAttribute("data-theme");

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  fakeSystem(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("the bar button (an icon, from tablet width)", () => {
  it("is a button named by the choice it shows and the one it goes to, at least 48 px", () => {
    render(<ThemeToggle variant="bar" />);

    const button = screen.getByRole("button", { name: "Colour theme: Light. Change to Dark." }); // Light is where everyone starts
    expect(button.className).toMatch(/min-h-12/);
    expect(button.className).toMatch(/min-w-12/);
    expect(button.textContent).toBe(""); // an icon only
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("starts on Light even when the device is dark, and when nothing is kept", async () => {
    fakeSystem(true);
    render(<ThemeToggle variant="bar" />);

    expect(await screen.findByRole("button", { name: "Colour theme: Light. Change to Dark." })).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0); // looking at the page keeps nothing
  });

  it("cycles Dark, System, Light, applies each at once, and keeps each choice", async () => {
    render(<ThemeToggle variant="bar" />);
    const press = () => userEvent.click(screen.getByRole("button"));

    await press();
    expect(screen.getByRole("button", { name: "Colour theme: Dark. Change to System." })).toBeInTheDocument();
    expect(theme()).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");

    await press();
    expect(screen.getByRole("button", { name: "Colour theme: System. Change to Light." })).toBeInTheDocument();
    expect(theme()).toBe("light"); // the device is light here
    expect(window.localStorage.getItem(THEME_KEY)).toBe("system");

    await press();
    expect(screen.getByRole("button", { name: "Colour theme: Light. Change to Dark." })).toBeInTheDocument();
    expect(theme()).toBe("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("System follows a dark device", async () => {
    fakeSystem(true);
    render(<ThemeToggle variant="bar" />);
    // Light -> Dark -> System
    await userEvent.click(await screen.findByRole("button", { name: /Colour theme: Light/ }));
    await userEvent.click(screen.getByRole("button", { name: /Colour theme: Dark/ }));

    expect(theme()).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("system");
  });

  it("shows the kept choice once the page is drawn (the first render is Light, so server and browser agree)", async () => {
    window.localStorage.setItem(THEME_KEY, "dark");
    render(<ThemeToggle variant="bar" />);

    expect(await screen.findByRole("button", { name: "Colour theme: Dark. Change to System." })).toBeInTheDocument();
  });

  it("says the new choice to a screen reader in a polite live region, which is not a role=status (a page has its own)", async () => {
    const { container } = render(<ThemeToggle variant="bar" />);
    await userEvent.click(screen.getByRole("button"));

    const region = container.querySelector("[data-theme-announcement]");
    expect(region).toHaveTextContent("Theme: Dark");
    expect(region?.className).toMatch(/sr-only/);
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the Menu button (icon and words, on a phone)", () => {
  it("shows the words 'Theme: Light', is a full-width row at least 48 px, and cycles the same way", async () => {
    render(<ThemeToggle variant="menu" />);

    const button = screen.getByRole("button", { name: "Theme: Light" });
    expect(button.className).toMatch(/min-h-12/);
    expect(button.className).toMatch(/w-full/);
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
    expect(theme()).toBe("dark");
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(theme()).toBe("light"); // the device is light here
  });
});
