// @vitest-environment jsdom
/** Tests for DecorativeIcon. Requirement: NFR-10 (icons are decoration; the text label carries the meaning). */
import { render } from "@testing-library/react";
import { Phone } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

describe("DecorativeIcon", () => {
  it("draws the icon it is given as an svg", () => {
    const { container } = render(<DecorativeIcon icon={Phone} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("hides the icon from screen readers and keeps it out of the tab order", () => {
    const { container } = render(<DecorativeIcon icon={Phone} />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.querySelector("title")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBeNull();
  });

  it("is 20 px by default and takes another size class", () => {
    const { container, rerender } = render(<DecorativeIcon icon={Phone} />);
    expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/\bh-5\b/);

    rerender(<DecorativeIcon icon={Phone} className="h-6 w-6" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/\bh-6\b/);
  });

  it("does not shrink in a tight row", () => {
    const { container } = render(<DecorativeIcon icon={Phone} />);
    expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/\bshrink-0\b/);
  });
});
