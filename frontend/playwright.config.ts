import { defineConfig } from "@playwright/test";

/** Real-browser checks (layout at several widths). Requirements: US-13, NFR-10. They are not part of `npm test` (Vitest, jsdom):
 * run them with `npm run test:e2e` while the site runs (`docker compose up`, or `npm run build && npm start`).
 * BASE_URL    the site to open (default http://localhost:3000).
 * CHROMIUM_PATH  a browser installed on the machine, for when Playwright's own download does not run there: in the Alpine
 *             container, `apk add chromium` and CHROMIUM_PATH=/usr/bin/chromium (it is then started with --no-sandbox).
 */
const chromiumPath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/end-to-end",
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    launchOptions: chromiumPath ? { executablePath: chromiumPath, args: ["--no-sandbox"] } : {},
  },
});
