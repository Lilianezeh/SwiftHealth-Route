// @vitest-environment jsdom
/** The minimal SwiftRescue page. Requirements: FR-14 (112 first and always), FR-02, NFR-10. UI spec 2.5, "Interim version".
 * Decision 18 in specs/2026-10-11-home-redesign/requirements.md: a large red "Call 112" button and one line, nothing else,
 * until the full page of phase 7. 112 is the NCC's national emergency number (the sources are in that decision).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";

import { readSource } from "../helpers/source";

describe("the emergency page", () => {
  it("has one h1, SwiftRescue", () => {
    render(<EmergencyPage />);

    const headings = screen.getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe("H1");
    expect(headings[0]).toHaveTextContent(/^SwiftRescue$/);
  });

  it("has a Call 112 link to exactly tel:112", () => {
    render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    expect(call).toHaveAttribute("href", "tel:112");
  });

  it("makes Call 112 red with white text, and large: at least 64 px high with 24 px text", () => {
    render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    expect(call.className).toMatch(/\bbg-emergency\b/);
    expect(call.className).toMatch(/\btext-white\b/);
    expect(call.className).toMatch(/\bmin-h-16\b/);
    expect(call.className).toMatch(/\btext-2xl\b/);
    expect(call.className).toMatch(/\bw-full\b/); // the whole width on a phone
  });

  it("gives the button a decorative icon beside the words, hidden from screen readers", () => {
    render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    expect(call.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("has the exact line about the full list coming soon", () => {
    render(<EmergencyPage />);

    expect(
      screen.getByText(
        "Our full list of verified ambulance, fire and hospital emergency numbers is coming soon.",
      ),
    ).toBeInTheDocument();
  });

  it("has nothing else: one link, one line, no list, no image, no advice, no old placeholder text", () => {
    const { container } = render(<EmergencyPage />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("ul, ol, img, button, form, input")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Coming soon\.?$/); // only the sentence about the list, not a bare placeholder
    expect(container.textContent).not.toMatch(/offline|112 first|sponsored|featured/i);
  });

  it("is a server page with no data: not a client component, no request", () => {
    const source = readSource("app/(public)/emergency/page.tsx");

    expect(source).not.toMatch(/["']use client["']/);
    expect(source).not.toMatch(/fetch\(|\basync\b|\bawait\b|lib\/api/);
  });

  it("calls only 112: no other phone number is on the page", () => {
    const { container } = render(<EmergencyPage />);

    const numbers = [...container.querySelectorAll('a[href^="tel:"]')].map((link) => link.getAttribute("href"));

    expect(numbers).toEqual(["tel:112"]);
  });
});
