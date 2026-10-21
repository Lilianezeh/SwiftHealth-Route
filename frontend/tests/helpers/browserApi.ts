/** Helpers for the real-browser (Playwright) specs of the staff screens and the facility form.
 * The API is faked with `page.route`: no staff password exists in these checks and nothing is written to the development database.
 * The browser sends a preflight for a JSON POST with an Authorization header, so the fake answers that too.
 */
import { expect, type Page, type Route } from "@playwright/test";

export const API = "http://localhost:8000";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
};

export type FakeRequest = { method: string; path: string; search: string; body: unknown; authorization: string | undefined };
export type FakeAnswer = { status?: number; body: unknown } | null; // null: pass the request through to the real API

/** Answers every call to the API with `answer(request)`; a preflight is always answered. Returns the list of requests seen. */
export async function fakeApi(page: Page, answer: (request: FakeRequest) => FakeAnswer): Promise<FakeRequest[]> {
  const seen: FakeRequest[] = [];
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const url = new URL(request.url());
    const fake: FakeRequest = {
      method: request.method(),
      path: url.pathname,
      search: url.search,
      // A JSON body is parsed; a CSV body (the import) stays text.
      body: request.postData() ? (request.headers()["content-type"]?.includes("json") ? JSON.parse(request.postData() as string) : request.postData()) : undefined,
      authorization: request.headers()["authorization"],
    };
    seen.push(fake);
    const result = answer(fake);
    if (result === null) {
      try {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), ...CORS } });
      } catch {
        // the page moved on or the test ended while this call was on its way: nothing is waiting for the answer
      }
      return;
    }
    await route.fulfill({ status: result.status ?? 200, contentType: "application/json", headers: CORS, body: JSON.stringify(result.body) });
  });
  return seen;
}

/** Puts a staff session in sessionStorage before any page script runs, as the login screen would. */
export async function logInAs(page: Page, role: "verifier" | "editor" | "admin" | "provider", id = 3): Promise<void> {
  const session = {
    token: "fake.token.value",
    user: { id, name: "Ada Staff", email: "ada@example.com", phone: "+2340000000001", role, is_active: true },
  };
  await page.addInitScript((value) => window.sessionStorage.setItem("swifthealth.staff-session", JSON.stringify(value)), session);
}

/** The page's own part (`main`) does not run past the screen and every control fits inside it. The header is left out on purpose
 * (a known width problem of this machine's fallback font between 344 and 370 px, see LOG.md). */
export async function allIsInsideTheScreen(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(() => (document.querySelector("main")?.scrollWidth ?? 0) - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of await page.locator("main h1, main h2, main button, main a, main input, main select, main textarea").all()) {
    const box = await control.boundingBox();
    if (!box) continue; // hidden (a screen-reader-only input)
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  }
}

/** Every button, link, select and text input of `main` that is shown is at least 48 px high (NFR-10), and text is 16 px or more. */
export async function targetsAndTextAreBigEnough(page: Page): Promise<void> {
  for (const control of await page.locator("main button, main a, main select, main input:not([type=checkbox]):not([type=radio]):not([type=file]), main textarea").all()) {
    const box = await control.boundingBox();
    if (box) expect.soft(box.height, `a control is ${box.height}px high`).toBeGreaterThanOrEqual(47.5);
  }
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main p, main h1, main h2, main label, main legend, main li, main button, main a, main select, main input, main textarea, main span")]
      .filter((element) => (element.textContent ?? "").trim() !== "" || ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName))
      .filter((element) => parseFloat(getComputedStyle(element).fontSize) < 16)
      .map((element) => `${element.tagName}: ${(element.textContent ?? "").slice(0, 30)}`),
  );
  expect(small).toEqual([]);
}
