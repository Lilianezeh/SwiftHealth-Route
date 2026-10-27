// @vitest-environment jsdom
/** Tests for CategoryShortcuts. Requirements: FR-01 (Hospitals, Clinics, Pharmacies, Maternity, Labs), NFR-10. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryShortcuts } from "@/components/search/CategoryShortcuts";

import { readSource } from "../helpers/source";

describe("CategoryShortcuts", () => {
  it("has the five shortcuts of FR-01 as plain links to a search by category, and Blood last", () => {
    render(<CategoryShortcuts />);

    const links = within(screen.getByRole("navigation", { name: "Categories" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
      ["Hospitals", "/search?category=hospital"],
      ["Clinics", "/search?category=clinic"],
      ["Pharmacies", "/search?category=pharmacy"],
      ["Maternity", "/search?category=maternity"],
      ["Labs", "/search?category=laboratory"],
      ["Blood", "/blood"],
    ]);
  });

  it("is not a client component (links need no script)", () => {
    const source = readSource("components/search/CategoryShortcuts.tsx");
    expect(source).not.toMatch(/["']use client["']/);
  });

  it("makes every shortcut at least 48 px high, with 16 px text", () => {
    render(<CategoryShortcuts />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className, link.textContent ?? "").toMatch(/min-h-12(\s|$)/);
      expect(link.className).toMatch(/\btext-base\b/);
    }
  });

  it("scrolls sideways inside its own row, so the page itself never scrolls sideways", () => {
    render(<CategoryShortcuts />);

    const list = screen.getByRole("list");
    expect(list.className).toMatch(/\boverflow-x-auto\b/);
    expect(screen.getByRole("navigation").className).toMatch(/\bmax-w-full\b|\bw-full\b|\bmin-w-0\b/);
  });

  it("uses the tokens for its colours", () => {
    render(<CategoryShortcuts />);

    const className = screen.getAllByRole("link")[0].className;
    expect(className).toMatch(/\bbg-surface\b/);
    expect(className).toMatch(/\btext-forest\b/);
  });
});
