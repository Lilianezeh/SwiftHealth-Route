// @vitest-environment jsdom
/** Tests for SearchBox. Requirements: FR-01, FR-04, NFR-04 (works before any script has loaded), NFR-10. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchBox } from "@/components/search/SearchBox";

import { readSource } from "../helpers/source";

describe("SearchBox", () => {
  it("is a plain GET form to /search, so it works without JavaScript", () => {
    render(<SearchBox />);

    const form = screen.getByRole("search");
    expect(form.tagName).toBe("FORM");
    expect(form).toHaveAttribute("action", "/search");
    expect(form.getAttribute("method")?.toLowerCase()).toBe("get");
  });

  it("is not a client component (it needs no script)", () => {
    const source = readSource("components/search/SearchBox.tsx");
    expect(source).not.toMatch(/["']use client["']/);
  });

  it("sends the text as q", () => {
    render(<SearchBox />);

    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("has a label for screen readers and the placeholder of the UI spec", () => {
    render(<SearchBox />);

    const input = screen.getByRole("searchbox", { name: "Search by name, area or service" });
    expect(input).toHaveAttribute("placeholder", "Search hospitals, pharmacies, labs…");
  });

  it("limits the text to 100 characters, as the API does", () => {
    render(<SearchBox />);

    expect(screen.getByRole("searchbox")).toHaveAttribute("maxlength", "100");
  });

  it("has a Search button with an icon and the word", () => {
    render(<SearchBox />);

    const button = screen.getByRole("button", { name: "Search" });
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(button).toHaveTextContent("Search");
  });

  it("is pre-filled when it is given a value", () => {
    render(<SearchBox defaultValue="Nigt Pharmcy" />);

    expect(screen.getByRole("searchbox")).toHaveValue("Nigt Pharmcy");
  });

  it("has a 56 px field and a 50 px button, with 16 px text (no zoom on a phone)", () => {
    render(<SearchBox />);

    expect(screen.getByRole("searchbox").className).toMatch(/min-h-14(\s|$)/);
    expect(screen.getByRole("searchbox").className).toMatch(/\btext-base\b/);
    expect(screen.getByRole("button").className).toMatch(/min-h-\[50px\]/);
  });
});
