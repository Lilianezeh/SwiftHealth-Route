/** Runs before every test file. Adds the jest-dom matchers (toBeInTheDocument...) and cleans up after each test. */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { clearPosition } from "@/lib/location/locationStore";

afterEach(() => {
  cleanup(); // remove what the test rendered, so the next test starts with an empty page
  clearPosition(); // the visitor's position lives in memory now (not in sessionStorage): forget it between tests
});
