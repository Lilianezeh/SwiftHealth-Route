// @vitest-environment jsdom
/** Proves the component test set-up works. Requirement: NFR-10 (we can test what a visitor sees and can do).
 *
 * A .tsx test file, JSX without importing React, the `@/` alias to src/, the jest-dom matchers and a click.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { toE164 } from "@/lib/formatters/phone";

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <section>
      <h1>Find care</h1>
      <button onClick={() => setCount(count + 1)}>Tapped {count} times</button>
    </section>
  );
}

describe("component test set-up", () => {
  it("renders a heading in a jsdom page", () => {
    render(<Counter />);
    expect(screen.getByRole("heading", { name: "Find care" })).toBeInTheDocument();
  });

  it("clicks a button like a visitor would", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("Tapped 1 times");
  });

  it("does not leave the previous test's page behind", () => {
    render(<Counter />);
    expect(screen.getAllByRole("heading")).toHaveLength(1); // cleanup ran after the earlier tests
  });

  it("resolves the @/ alias to src/", () => {
    expect(toE164("08030000000")).toBe("+2348030000000");
  });
});
