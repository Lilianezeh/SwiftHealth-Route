/** Runs before every test file. Adds the jest-dom matchers (toBeInTheDocument...) and cleans up after each test. */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup(); // remove what the test rendered, so the next test starts with an empty page
});
